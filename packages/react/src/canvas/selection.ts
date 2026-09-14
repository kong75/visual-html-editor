import type { EditorController, InlineMark, InlineTextStyleProperty, NodeKey, ParsedNode, TextRange } from '@visual-html/core';
import { resolveElementBehavior, type ElementBehaviorResolver } from '../element-behavior.js';
import type { EditorTextSelection } from '../editor-types.js';
import { runtimeAttributes } from './attributes.js';

export interface RuntimeHitCandidate {
  element: HTMLElement;
  key: NodeKey;
  node: ParsedNode;
}

export interface RuntimePointerPoint {
  x: number;
  y: number;
  space: 'document' | 'parent';
}

export type RichTextSelectionState = EditorTextSelection;

export const inlineTextStyleProperties: readonly InlineTextStyleProperty[] = [
  'font-family', 'font-size', 'font-weight', 'color', 'line-height', 'letter-spacing'
];

export function queryRuntimeElement(frame: HTMLIFrameElement | null, key: NodeKey | null): HTMLElement | null {
  if (!frame || !key) return null;
  const doc = frame.contentDocument;
  return doc?.querySelector<HTMLElement>(`[${runtimeAttributes(doc).node}="${key}"]`) ?? null;
}

const structuralRegionTags = new Set(['html', 'head', 'body', 'style', 'script', 'title', 'template', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'ul', 'ol', 'dl', 'select', 'picture', 'svg']);

const semanticTextRegionTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote', 'td', 'th', 'label', 'button']);

const richTextInlineTags = new Set(['span', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike', 'a', 'small', 'code', 'mark', 'br', 'wbr', 'img', 'picture', 'source', 'sub', 'sup', 'abbr', 'cite', 'q', 'time', 'ruby', 'rt', 'rp', 'bdi', 'bdo']);

export function isRichTextRegion(node: ParsedNode, controller: EditorController): boolean {
  if (!node.innerRange || structuralRegionTags.has(node.tagName)) return false;
  // A generic layout wrapper around one text element is still a separate
  // layer. Promote mixed direct text, not a card containing only its label.
  if (!semanticTextRegionTags.has(node.tagName) && !richTextInlineTags.has(node.tagName) && node.childKeys.length === 1) {
    const child = controller.getNode(node.childKeys[0]);
    if (child && node.textContent.trim() === child.textContent.trim()) return false;
  }
  const visit = (candidate: ParsedNode): boolean => candidate.childKeys.every((key) => {
    const child = controller.getNode(key);
    return Boolean(child && richTextInlineTags.has(child.tagName) && visit(child));
  });
  return visit(node);
}

function resolveRichTextRegion(element: HTMLElement, controller: EditorController): RuntimeHitCandidate | undefined {
  let candidate: HTMLElement | null = element;
  let inlineFallback: RuntimeHitCandidate | undefined;
  const attrs = runtimeAttributes(element.ownerDocument);
  while (candidate) {
    const key = candidate.getAttribute(attrs.node);
    const node = key ? controller.getNode(key) : undefined;
    if (key && node && isRichTextRegion(node, controller)) {
      const region = { element: candidate, key, node };
      if (!richTextInlineTags.has(node.tagName)) return region;
      inlineFallback = region;
    }
    candidate = candidate.parentElement;
  }
  return inlineFallback;
}

export function resolveEditingRegion(
  element: HTMLElement,
  key: NodeKey,
  node: ParsedNode,
  controller: EditorController,
  nodes: ReadonlyMap<NodeKey, ParsedNode>,
  resolvers: readonly ElementBehaviorResolver[]
): RuntimeHitCandidate {
  const behavior = resolveElementBehavior(node, nodes, resolvers);
  if (behavior.editTarget === 'self') return { element, key, node };
  return resolveRichTextRegion(element, controller) ?? { element, key, node };
}

export function pointTextOffset(root: HTMLElement, container: Node, offset: number): number | undefined {
  let total = 0;
  const visit = (node: Node): number | undefined => {
    if (node === container) {
      if (node.nodeType === Node.TEXT_NODE) return total + Math.min(offset, node.textContent?.length ?? 0);
      const children = [...node.childNodes];
      for (let index = 0; index < Math.min(offset, children.length); index += 1) total += children[index].textContent?.length ?? 0;
      return total;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      total += node.textContent?.length ?? 0;
      return undefined;
    }
    for (const child of node.childNodes) {
      const result = visit(child);
      if (result !== undefined) return result;
    }
    return undefined;
  };
  return visit(root);
}

function pointAtTextOffset(root: HTMLElement, requestedOffset: number): { node: Node; offset: number } | undefined {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = requestedOffset;
  let last: Text | undefined;
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    last = text;
    const length = text.data.length;
    if (remaining <= length) return { node: text, offset: remaining };
    remaining -= length;
  }
  return last ? { node: last, offset: last.data.length } : undefined;
}

function markActiveAcrossRange(root: HTMLElement, range: TextRange, aliases: readonly string[]): boolean {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cursor = 0;
  let selectedLength = 0;
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    const start = cursor;
    const end = start + text.data.length;
    cursor = end;
    const overlap = Math.max(0, Math.min(end, range.end) - Math.max(start, range.start));
    if (overlap === 0) continue;
    selectedLength += overlap;
    let parent = text.parentElement;
    let marked = false;
    while (parent && root.contains(parent)) {
      if (aliases.some((selector) => parent!.matches(selector))) { marked = true; break; }
      if (parent === root) break;
      parent = parent.parentElement;
    }
    if (!marked) return false;
  }
  return selectedLength > 0;
}

function stylesAcrossRange(
  root: HTMLElement,
  range: TextRange
): Readonly<Record<InlineTextStyleProperty, string | null>> {
  const values = Object.fromEntries(inlineTextStyleProperties.map((property) => [property, undefined])) as Record<
    InlineTextStyleProperty,
    string | null | undefined
  >;
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cursor = 0;
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    const start = cursor;
    const end = start + text.data.length;
    cursor = end;
    if (Math.max(0, Math.min(end, range.end) - Math.max(start, range.start)) === 0) continue;
    const textElement = text.parentElement ?? root;
    const computed = doc.defaultView?.getComputedStyle(textElement);
    for (const property of inlineTextStyleProperties) {
      let authored = '';
      let candidate: HTMLElement | null = textElement;
      while (candidate && root.contains(candidate)) {
        authored = candidate.style.getPropertyValue(property).trim();
        if (authored || candidate === root) break;
        candidate = candidate.parentElement;
      }
      const next = authored || computed?.getPropertyValue(property).trim() || '';
      if (values[property] === undefined) values[property] = next;
      else if (values[property] !== next) values[property] = null;
    }
  }
  return Object.fromEntries(inlineTextStyleProperties.map((property) => [property, values[property] ?? null])) as Record<
    InlineTextStyleProperty,
    string | null
  >;
}

export function readRichTextSelection(
  doc: Document,
  controller: EditorController,
  nodes: ReadonlyMap<NodeKey, ParsedNode>,
  resolvers: readonly ElementBehaviorResolver[]
): RichTextSelectionState | null {
  const attrs = runtimeAttributes(doc);
  const selection = doc.defaultView?.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const domRange = selection.getRangeAt(0);
  const startElement = domRange.startContainer.nodeType === Node.ELEMENT_NODE
    ? domRange.startContainer as HTMLElement
    : domRange.startContainer.parentElement;
  if (!startElement) return null;
  const editingRoot = startElement.closest<HTMLElement>(`[${attrs.editing}="true"]`);
  const runtimeElement = editingRoot ?? startElement.closest<HTMLElement>(`[${attrs.node}]`);
  if (!runtimeElement) return null;
  const key = runtimeElement.getAttribute(attrs.node);
  const node = key ? controller.getNode(key) : undefined;
  if (!key || !node) return null;
  const region = editingRoot ? { element: editingRoot, key, node } : resolveEditingRegion(runtimeElement, key, node, controller, nodes, resolvers);
  if (!region || !region.element.contains(domRange.endContainer)) return null;
  const start = pointTextOffset(region.element, domRange.startContainer, domRange.startOffset);
  const end = pointTextOffset(region.element, domRange.endContainer, domRange.endOffset);
  if (start === undefined || end === undefined || end <= start) return null;
  const range = { start, end };
  return {
    nodeKey: region.key,
    range,
    activeMarks: {
      strong: markActiveAcrossRange(region.element, range, ['strong', 'b']),
      em: markActiveAcrossRange(region.element, range, ['em', 'i']),
      u: markActiveAcrossRange(region.element, range, ['u']),
      s: markActiveAcrossRange(region.element, range, ['s', 'del', 'strike'])
    },
    activeStyles: stylesAcrossRange(region.element, range)
  };
}

export function restoreRichTextSelection(element: HTMLElement, range: TextRange): boolean {
  const start = pointAtTextOffset(element, range.start);
  const end = pointAtTextOffset(element, range.end);
  const selection = element.ownerDocument.defaultView?.getSelection();
  if (!start || !end || !selection) return false;
  const domRange = element.ownerDocument.createRange();
  domRange.setStart(start.node, start.offset);
  domRange.setEnd(end.node, end.offset);
  selection.removeAllRanges();
  selection.addRange(domRange);
  return true;
}

export function replaceSelectionWithText(doc: Document, text: string): boolean {
  const selection = doc.defaultView?.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  if (text) {
    const fragment = doc.createDocumentFragment();
    for (const [index, line] of text.replace(/\r\n?/g, '\n').split('\n').entries()) {
      if (index > 0) fragment.append(doc.createElement('br'));
      if (line) fragment.append(doc.createTextNode(line));
    }
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);
    if (lastNode) range.setStartAfter(lastNode);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

export function syncRuntimeSelection(frame: HTMLIFrameElement | null, key: NodeKey | null): void {
  const doc = frame?.contentDocument;
  if (!doc) return;
  const attrs = runtimeAttributes(doc);
  for (const element of doc.querySelectorAll<HTMLElement>(`[${attrs.selected}="true"]`)) {
    element.removeAttribute(attrs.selected);
  }
  queryRuntimeElement(frame, key)?.setAttribute(attrs.selected, 'true');
}

export function runtimeHitCandidates(
  doc: Document,
  controller: EditorController,
  clientX: number,
  clientY: number
): RuntimeHitCandidate[] {
  const attrs = runtimeAttributes(doc);
  const FrameHTMLElement = doc.defaultView?.HTMLElement;
  if (!FrameHTMLElement) return [];

  const candidates: RuntimeHitCandidate[] = [];
  const seen = new Set<NodeKey>();
  for (const hit of doc.elementsFromPoint(clientX, clientY)) {
    if (!(hit instanceof FrameHTMLElement)) continue;
    const element = hit.hasAttribute(attrs.node)
      ? hit
      : hit.closest<HTMLElement>(`[${attrs.node}]`);
    const key = element?.getAttribute(attrs.node);
    const node = key ? controller.getNode(key) : undefined;
    if (!element || !key || !node || seen.has(key) || ['html', 'head', 'body'].includes(node.tagName)) continue;
    seen.add(key);
    candidates.push({ element, key, node });
  }
  return candidates;
}

export function cycleHitCandidate(candidates: readonly RuntimeHitCandidate[], selectedKey: NodeKey | null): RuntimeHitCandidate | undefined {
  if (!candidates.length) return undefined;
  const selectedIndex = candidates.findIndex((candidate) => candidate.key === selectedKey);
  return candidates[(selectedIndex + 1 + candidates.length) % candidates.length];
}

function pointFromParentViewport(frame: HTMLIFrameElement, doc: Document, clientX: number, clientY: number): RuntimePointerPoint {
  const frameRect = frame.getBoundingClientRect();
  const viewportWidth = doc.defaultView?.innerWidth ?? frame.clientWidth;
  const viewportHeight = doc.defaultView?.innerHeight ?? frame.clientHeight;
  return {
    x: (clientX - frameRect.left) * viewportWidth / Math.max(1, frameRect.width),
    y: (clientY - frameRect.top) * viewportHeight / Math.max(1, frameRect.height),
    space: 'parent'
  };
}

export function runtimePointerPoint(
  frame: HTMLIFrameElement,
  doc: Document,
  event: MouseEvent | PointerEvent,
  target: HTMLElement,
  space?: RuntimePointerPoint['space']
): RuntimePointerPoint {
  if (space === 'parent') return pointFromParentViewport(frame, doc, event.clientX, event.clientY);
  if (space === 'document') return { x: event.clientX, y: event.clientY, space };

  const directHit = doc.elementFromPoint(event.clientX, event.clientY);
  if (directHit === target || (directHit && target.contains(directHit))) {
    return { x: event.clientX, y: event.clientY, space: 'document' };
  }

  const converted = pointFromParentViewport(frame, doc, event.clientX, event.clientY);
  const convertedHit = doc.elementFromPoint(converted.x, converted.y);
  if (convertedHit === target || (convertedHit && target.contains(convertedHit))) return converted;
  return { x: event.clientX, y: event.clientY, space: 'document' };
}
