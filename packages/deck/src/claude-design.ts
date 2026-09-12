import { parse, serialize, serializeOuter, type DefaultTreeAdapterMap } from 'parse5';
import { normalizeDeck } from './serialization.js';
import type { ClaudeDesignImportResult, HtmlDeck, HtmlDeckSlide } from './types.js';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

interface ClaudeAdapterData {
  headHtml?: string;
  bodyAttributes?: string;
  deckAttributes?: string;
  runtimeHtml?: string;
}

function isElement(node: Node): node is Element {
  return 'tagName' in node;
}

function children(node: Node): readonly Node[] {
  return 'childNodes' in node ? node.childNodes : [];
}

function walk(node: Node, visit: (candidate: Node) => boolean): Node | undefined {
  if (visit(node)) return node;
  for (const child of children(node)) {
    const match = walk(child, visit);
    if (match) return match;
  }
  return undefined;
}

function findElement(node: Node, tagName: string): Element | undefined {
  const match = walk(node, (candidate) => isElement(candidate) && candidate.tagName === tagName);
  return match && isElement(match) ? match : undefined;
}

function getAttribute(element: Element, name: string): string | undefined {
  return element.attrs.find((attribute) => attribute.name === name)?.value;
}

function attributesToSource(element: Element, omit: readonly string[] = []): string {
  return element.attrs
    .filter((attribute) => !omit.includes(attribute.name))
    .map((attribute) => attribute.value
      ? `${attribute.name}="${attribute.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`
      : attribute.name)
    .join(' ');
}

function nodeText(node: Node): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  return children(node).map(nodeText).join('');
}

function headingText(section: Element): string | undefined {
  const heading = walk(section, (candidate) => isElement(candidate) && /^h[1-3]$/.test(candidate.tagName));
  const text = heading ? nodeText(heading).replace(/\s+/g, ' ').trim() : '';
  return text || undefined;
}

function ensureAttribute(markup: string, name: string, value?: string): string {
  const openingTag = markup.match(/^<section\b[^>]*>/i)?.[0];
  if (!openingTag) return markup;
  const attributePattern = new RegExp(`\\s${name}(?:=(?:"[^"]*"|'[^']*'|[^\\s>]+))?`, 'i');
  const withoutAttribute = openingTag.replace(attributePattern, '');
  const rendered = value === undefined ? name : `${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
  return markup.replace(openingTag, withoutAttribute.replace(/>$/, ` ${rendered}>`));
}

function parseDimension(element: Element, axis: 'width' | 'height', fallback: number): number {
  const direct = getAttribute(element, `data-${axis}`) ?? getAttribute(element, axis);
  if (direct && Number.isFinite(Number.parseFloat(direct))) return Number.parseFloat(direct);
  const style = getAttribute(element, 'style') ?? '';
  const custom = style.match(new RegExp(`--deck-${axis}\\s*:\\s*([0-9.]+)`, 'i'))?.[1];
  if (custom && Number.isFinite(Number.parseFloat(custom))) return Number.parseFloat(custom);
  return fallback;
}

function extractNotes(root: Node, slides: readonly Element[]): string[] {
  const notesScript = walk(root, (candidate) => isElement(candidate)
    && candidate.tagName === 'script'
    && getAttribute(candidate, 'id') === 'speaker-notes');
  if (!notesScript || !isElement(notesScript)) return slides.map(() => '');
  try {
    const parsed = JSON.parse(nodeText(notesScript)) as unknown;
    if (Array.isArray(parsed)) {
      return slides.map((_, index) => {
        const value = parsed[index];
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object') {
          const record = value as Record<string, unknown>;
          return typeof record.notes === 'string' ? record.notes : typeof record.text === 'string' ? record.text : '';
        }
        return '';
      });
    }
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      return slides.map((slide, index) => {
        const key = getAttribute(slide, 'id') ?? getAttribute(slide, 'data-screen-label') ?? String(index + 1);
        const value = record[key];
        return typeof value === 'string' ? value : '';
      });
    }
  } catch {
    return slides.map(() => '');
  }
  return slides.map(() => '');
}

function documentTitle(root: Node): string | undefined {
  const title = findElement(root, 'title');
  const text = title ? nodeText(title).trim() : '';
  return text || undefined;
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return normalized || 'claude-design-deck';
}

function createSlideDocument(headHtml: string, bodyAttributes: string, deckAttributes: string, sectionHtml: string): string {
  return `<!doctype html>
<html>
<head>${headHtml}
  <style data-visual-html-deck-preview>
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    deck-stage { position: relative; display: block; width: 100%; height: 100%; overflow: hidden; }
    deck-stage > section { position: relative; display: block !important; width: 100%; height: 100%; box-sizing: border-box; }
  </style>
</head>
<body${bodyAttributes ? ` ${bodyAttributes}` : ''}>
  <deck-stage${deckAttributes ? ` ${deckAttributes}` : ''}>
    ${ensureAttribute(sectionHtml, 'data-deck-active')}
  </deck-stage>
</body>
</html>`;
}

function adapterData(deck: HtmlDeck): ClaudeAdapterData {
  const candidate = deck.metadata?.claudeDesign;
  return candidate && typeof candidate === 'object' ? candidate as ClaudeAdapterData : {};
}

function firstSlideMarkup(source: string, index: number, label?: string): string {
  const document = parse(source);
  const stage = findElement(document, 'deck-stage');
  const section = stage
    ? children(stage).find((node): node is Element => isElement(node) && node.tagName === 'section')
    : undefined;
  let markup: string;
  if (section) {
    markup = serializeOuter(section);
  } else {
    const body = findElement(document, 'body');
    markup = `<section>${body ? serialize(body) : source}</section>`;
  }
  markup = ensureAttribute(markup, 'data-deck-active');
  return ensureAttribute(markup, 'data-screen-label', label ?? String(index + 1));
}

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function escapeHtmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function exportHead(deck: HtmlDeck, source: ClaudeAdapterData): string {
  const heads = deck.slides.map((slide) => {
    const head = findElement(parse(slide.html), 'head');
    const nodes = (head?.childNodes ?? []).filter((node) => !(isElement(node)
      && node.tagName === 'style' && getAttribute(node, 'data-visual-html-deck-preview') !== undefined));
    const styles = nodes.filter((node) => isElement(node) && ['style', 'link'].includes(node.tagName))
      .map((node) => serializeOuter(node)).join('\n');
    return { slide, nodes, styles };
  });
  const first = heads[0];
  const incompatible = heads.find((head) => head.styles !== first.styles);
  if (incompatible) {
    // A single document has a shared cascade. Combining independent sheets
    // would silently change other slides; the JSON format retains them all.
    throw new Error(`Slides “${first.slide.id}” and “${incompatible.slide.id}” use different head stylesheets. Export them separately or make their stylesheets match before exporting one HTML deck.`);
  }

  const current = first.nodes.map((node) => serializeOuter(node));
  // Imported runtime scripts were intentionally omitted from slide previews.
  // Restore those scripts, while taking editable head content from live slides.
  const originalHead = source.headHtml ? findElement(parse(source.headHtml), 'head') : undefined;
  const runtimeScripts = (originalHead?.childNodes ?? [])
    .filter((node) => isElement(node) && node.tagName === 'script')
    .map((node) => serializeOuter(node))
    .filter((markup) => !current.includes(markup));
  const currentHead = current.join('');
  return (currentHead.trim() ? currentHead
    : `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtmlText(deck.title ?? 'Visual HTML deck')}</title>`)
    + runtimeScripts.join('');
}

function defaultRuntime(width: number, height: number): string {
  return `<style data-visual-html-deck-runtime>
html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #111116; }
deck-stage { position: relative; display: block; width: 100vw; height: 100vh; overflow: hidden; }
deck-stage > section { position: absolute; top: 50%; left: 50%; display: none; width: ${width}px; height: ${height}px; box-sizing: border-box; transform-origin: center; }
deck-stage > section[data-deck-current] { display: block; }
@media print {
  html, body, deck-stage { width: auto; height: auto; overflow: visible; background: #fff; }
  deck-stage > section { position: relative; top: auto; left: auto; display: block !important; break-after: page; transform: none !important; }
}
</style>
<script data-visual-html-deck-runtime>
(() => {
  const stage = document.querySelector('deck-stage');
  if (!stage) return;
  const slides = Array.from(stage.children).filter((element) => element.tagName === 'SECTION');
  let index = Math.max(0, Math.min(Number(localStorage.getItem('visual-html-slide-index') || 0), slides.length - 1));
  const render = () => {
    const scale = Math.min(innerWidth / ${width}, innerHeight / ${height});
    slides.forEach((slide, slideIndex) => {
      slide.toggleAttribute('data-deck-current', slideIndex === index);
      slide.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
    });
    localStorage.setItem('visual-html-slide-index', String(index));
    parent.postMessage({ slideIndexChanged: index }, '*');
  };
  const move = (delta) => { index = Math.max(0, Math.min(index + delta, slides.length - 1)); render(); };
  addEventListener('keydown', (event) => {
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); move(1); }
    if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); move(-1); }
    if (event.key === 'Home') { index = 0; render(); }
    if (event.key === 'End') { index = slides.length - 1; render(); }
  });
  addEventListener('resize', render);
  render();
})();
</script>`;
}

export function isClaudeDesignDeck(source: string): boolean {
  const document = parse(source);
  const stage = findElement(document, 'deck-stage');
  return Boolean(stage && children(stage).some((node) => isElement(node) && node.tagName === 'section'));
}

export function importClaudeDesignDeck(source: string): ClaudeDesignImportResult {
  const document = parse(source);
  const stage = findElement(document, 'deck-stage');
  if (!stage) throw new Error('No <deck-stage> element was found.');
  const sections = children(stage).filter((node): node is Element => isElement(node) && node.tagName === 'section');
  if (!sections.length) throw new Error('The <deck-stage> element does not contain any direct-child slides.');

  const head = findElement(document, 'head');
  const body = findElement(document, 'body');
  const headHtml = head ? serialize(head) : '';
  const previewHeadHtml = head
    ? head.childNodes.filter((node) => !(isElement(node) && node.tagName === 'script')).map((node) => serializeOuter(node)).join('')
    : '';
  const bodyAttributes = body ? attributesToSource(body) : '';
  const deckAttributes = attributesToSource(stage, ['data-width', 'data-height', 'width', 'height']);
  const notes = extractNotes(document, sections);
  const runtimeHtml = body
    ? body.childNodes
      .filter((node) => node !== stage && !(isElement(node) && node.tagName === 'script' && getAttribute(node, 'id') === 'speaker-notes'))
      .map((node) => serializeOuter(node))
      .join('\n')
      .trim()
    : '';
  const title = documentTitle(document) ?? 'Claude Design deck';
  const slides: HtmlDeckSlide[] = sections.map((section, index) => {
    const label = getAttribute(section, 'data-screen-label') ?? String(index + 1);
    const id = getAttribute(section, 'id') ?? `slide-${index + 1}`;
    return {
      id,
      label,
      title: headingText(section) ?? `Slide ${index + 1}`,
      notes: notes[index] || undefined,
      html: createSlideDocument(previewHeadHtml, bodyAttributes, deckAttributes, serializeOuter(section)),
      metadata: { sourceFormat: 'claude-design' }
    };
  });

  const warnings = runtimeHtml
    ? [{ code: 'runtime-preserved', message: 'Runtime HTML outside <deck-stage> was preserved for re-export but is not executed in slide previews.' }]
    : [];
  return {
    deck: normalizeDeck({
      schema: 'visual-html-deck',
      version: 1,
      id: slug(title),
      title,
      width: parseDimension(stage, 'width', 1920),
      height: parseDimension(stage, 'height', 1080),
      slides,
      metadata: {
        sourceFormat: 'claude-design',
        claudeDesign: { headHtml, bodyAttributes, deckAttributes, runtimeHtml }
      }
    }),
    warnings
  };
}

export function exportClaudeDesignDeck(deckInput: HtmlDeck): string {
  const deck = normalizeDeck(deckInput);
  const source = adapterData(deck);
  const headHtml = exportHead(deck, source);
  const sections = deck.slides.map((slide, index) => firstSlideMarkup(slide.html, index, slide.label)).join('\n');
  const notes = deck.slides.map((slide) => slide.notes ?? '');
  const runtime = source.runtimeHtml || defaultRuntime(deck.width, deck.height);
  return `<!doctype html>
<html>
<head>${headHtml}</head>
<body${source.bodyAttributes ? ` ${source.bodyAttributes}` : ''}>
  <deck-stage${source.deckAttributes ? ` ${source.deckAttributes}` : ''} data-width="${deck.width}" data-height="${deck.height}">
${sections}
  </deck-stage>
  <script type="application/json" id="speaker-notes">${escapeJsonForHtml(notes)}</script>
${runtime}
</body>
</html>`;
}
