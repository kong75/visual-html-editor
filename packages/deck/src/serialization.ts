import type { HtmlDeck, HtmlDeckSlide } from './types.js';

function copyMetadata(metadata: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> | undefined {
  return metadata ? { ...metadata } : undefined;
}

export function cloneSlide(slide: HtmlDeckSlide): HtmlDeckSlide {
  return {
    ...slide,
    metadata: copyMetadata(slide.metadata)
  };
}

export function normalizeDeck(deck: HtmlDeck): HtmlDeck {
  if (deck.schema !== 'visual-html-deck' || deck.version !== 1) {
    throw new Error('Unsupported Visual HTML deck schema or version.');
  }
  if (!deck.id.trim()) throw new Error('Deck id is required.');
  if (!Number.isFinite(deck.width) || deck.width <= 0 || !Number.isFinite(deck.height) || deck.height <= 0) {
    throw new Error('Deck dimensions must be positive finite numbers.');
  }
  if (!deck.slides.length) throw new Error('A deck must contain at least one slide.');

  const ids = new Set<string>();
  const slides = deck.slides.map((slide) => {
    if (!slide.id.trim()) throw new Error('Every slide must have an id.');
    if (ids.has(slide.id)) throw new Error(`Duplicate slide id: ${slide.id}`);
    if (typeof slide.html !== 'string') throw new Error(`Slide ${slide.id} must contain HTML source.`);
    ids.add(slide.id);
    return cloneSlide(slide);
  });

  return {
    ...deck,
    slides,
    metadata: copyMetadata(deck.metadata)
  };
}

export function createBlankSlideHtml(width: number, height: number, title = 'Untitled slide'): string {
  const safeTitle = title.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character] ?? character);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
</head>
<body style="margin: 0; width: 100%; height: 100%; overflow: hidden; background: #f7f6f2; color: #1d1c22; font-family: Arial, sans-serif;">
  <main style="box-sizing: border-box; display: flex; width: 100%; height: 100%; min-height: ${height}px; align-items: center; justify-content: center; padding: 8%;">
    <h1 style="margin: 0; font-size: ${Math.max(40, Math.round(width * 0.05))}px; letter-spacing: -0.04em;">${safeTitle}</h1>
  </main>
</body>
</html>`;
}

export function serializeDeck(deck: HtmlDeck, space = 2): string {
  return JSON.stringify(normalizeDeck(deck), null, space);
}

export function parseDeck(source: string): HtmlDeck {
  const parsed = JSON.parse(source) as HtmlDeck;
  return normalizeDeck(parsed);
}
