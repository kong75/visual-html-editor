import { parseFragment } from 'parse5';
import { DecodingMode, EntityDecoder, htmlDecodeTree } from 'entities/decode';
import type { InlineMark, TextRange } from './types.js';

interface SourceLocation {
  startOffset: number;
  endOffset: number;
  startTag?: SourceLocation;
  endTag?: SourceLocation;
}

interface HtmlNode {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
  sourceCodeLocation?: SourceLocation;
}

export interface RichTextSourceEdit {
  start: number;
  end: number;
  replacement: string;
}

interface Piece {
  html: string;
  selected: boolean;
  active: boolean;
}

interface TransformState {
  source: string;
  range: TextRange;
  mark: InlineMark;
  cursor: number;
}

export interface InlineMarkTransform {
  html: string;
  active: boolean;
  action: 'add' | 'remove';
}

export class RichTextRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RichTextRangeError';
  }
}

const markAliases: Readonly<Record<InlineMark, ReadonlySet<string>>> = {
  strong: new Set(['strong', 'b']),
  em: new Set(['em', 'i']),
  u: new Set(['u']),
  s: new Set(['s', 'del', 'strike'])
};

export function isInlineMarkTag(tagName: string, mark: InlineMark): boolean {
  return markAliases[mark].has(tagName.toLowerCase());
}

function locationOf(node: HtmlNode): SourceLocation | undefined {
  return node.sourceCodeLocation;
}

function textLength(node: HtmlNode): number {
  if (node.nodeName === '#text') return node.value?.length ?? 0;
  return (node.childNodes ?? []).reduce((total, child) => total + textLength(child), 0);
}

function selectionOverlaps(start: number, end: number, range: TextRange): boolean {
  return start < range.end && end > range.start;
}

function decodeEntityAt(source: string, offset: number): { consumed: number; text: string } | undefined {
  const emitted: string[] = [];
  const decoder = new EntityDecoder(htmlDecodeTree, (codepoint) => emitted.push(String.fromCodePoint(codepoint)));
  decoder.startEntity(DecodingMode.Legacy);
  let consumed = decoder.write(source, offset + 1);
  if (consumed < 0) consumed = decoder.end();
  if (consumed <= 1 || emitted.length === 0) return undefined;
  return { consumed, text: emitted.join('') };
}

function textBoundaryMap(raw: string, decodedLength: number): Array<number | undefined> {
  const boundaries: Array<number | undefined> = [0];
  let sourceOffset = 0;
  let decodedOffset = 0;

  const appendToken = (sourceLength: number, decoded: string) => {
    for (let index = 1; index < decoded.length; index += 1) boundaries[decodedOffset + index] = undefined;
    decodedOffset += decoded.length;
    sourceOffset += sourceLength;
    boundaries[decodedOffset] = sourceOffset;
  };

  while (sourceOffset < raw.length) {
    if (raw.startsWith('\r\n', sourceOffset)) {
      appendToken(2, '\n');
      continue;
    }
    if (raw[sourceOffset] === '\r') {
      appendToken(1, '\n');
      continue;
    }
    if (raw[sourceOffset] === '&') {
      const entity = decodeEntityAt(raw, sourceOffset);
      if (entity) {
        appendToken(entity.consumed, entity.text);
        continue;
      }
    }
    const codepoint = raw.codePointAt(sourceOffset);
    if (codepoint === undefined) break;
    const value = String.fromCodePoint(codepoint);
    appendToken(value.length, value);
  }

  if (decodedOffset !== decodedLength) {
    throw new RichTextRangeError('The selected text could not be mapped back to its HTML source.');
  }
  return boundaries;
}

function splitText(node: HtmlNode, active: boolean, state: TransformState): Piece[] {
  const location = locationOf(node);
  const value = node.value ?? '';
  const nodeStart = state.cursor;
  const nodeEnd = nodeStart + value.length;
  state.cursor = nodeEnd;
  if (!location) return [{ html: value, selected: false, active }];

  const raw = state.source.slice(location.startOffset, location.endOffset);
  if (!selectionOverlaps(nodeStart, nodeEnd, state.range)) return [{ html: raw, selected: false, active }];

  const localStart = Math.max(0, state.range.start - nodeStart);
  const localEnd = Math.min(value.length, state.range.end - nodeStart);
  const boundaries = textBoundaryMap(raw, value.length);
  const sourceStart = boundaries[localStart];
  const sourceEnd = boundaries[localEnd];
  if (sourceStart === undefined || sourceEnd === undefined) {
    throw new RichTextRangeError('A formatting boundary cannot split a single HTML character reference.');
  }

  const pieces: Piece[] = [];
  if (sourceStart > 0) pieces.push({ html: raw.slice(0, sourceStart), selected: false, active });
  if (sourceEnd > sourceStart) pieces.push({ html: raw.slice(sourceStart, sourceEnd), selected: true, active });
  if (sourceEnd < raw.length) pieces.push({ html: raw.slice(sourceEnd), selected: false, active });
  return pieces;
}

function rawNode(node: HtmlNode, source: string): string {
  const location = locationOf(node);
  return location ? source.slice(location.startOffset, location.endOffset) : '';
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function attributesMatch(left: HtmlNode, right: HtmlNode): boolean {
  const leftAttributes = new Map((left.attrs ?? []).map((attribute) => [attribute.name, attribute.value]));
  const rightAttributes = new Map((right.attrs ?? []).map((attribute) => [attribute.name, attribute.value]));
  if (leftAttributes.size !== rightAttributes.size) return false;
  for (const [name, value] of leftAttributes) {
    if (rightAttributes.get(name) !== value) return false;
  }
  return true;
}

function collectTextSourceEdits(
  sourceNode: HtmlNode,
  editedNode: HtmlNode,
  edits: RichTextSourceEdit[]
): boolean {
  if (sourceNode.nodeName !== editedNode.nodeName || sourceNode.tagName !== editedNode.tagName) return false;
  if (sourceNode.nodeName === '#text') {
    if ((sourceNode.value ?? '') === (editedNode.value ?? '')) return true;
    const location = locationOf(sourceNode);
    if (!location) return false;
    edits.push({ start: location.startOffset, end: location.endOffset, replacement: escapeText(editedNode.value ?? '') });
    return true;
  }
  if (!attributesMatch(sourceNode, editedNode)) return false;
  const sourceChildren = sourceNode.childNodes ?? [];
  const editedChildren = editedNode.childNodes ?? [];
  if (sourceChildren.length !== editedChildren.length) return false;
  return sourceChildren.every((child, index) => collectTextSourceEdits(child, editedChildren[index], edits));
}

export function richTextSourceEdits(source: string, edited: string): RichTextSourceEdit[] | null {
  const sourceFragment = parseFragment(source, { sourceCodeLocationInfo: true }) as unknown as { childNodes: HtmlNode[] };
  const editedFragment = parseFragment(edited) as unknown as { childNodes: HtmlNode[] };
  const sourceNodes = sourceFragment.childNodes ?? [];
  const editedNodes = editedFragment.childNodes ?? [];
  if (sourceNodes.length !== editedNodes.length) return null;
  const edits: RichTextSourceEdit[] = [];
  if (!sourceNodes.every((node, index) => collectTextSourceEdits(node, editedNodes[index], edits))) return null;
  return edits;
}

function appendChildren(node: HtmlNode, render: (child: HtmlNode) => string, source: string): string {
  const location = locationOf(node);
  const start = location?.startTag?.endOffset ?? location?.startOffset ?? 0;
  const end = location?.endTag?.startOffset ?? location?.endOffset ?? start;
  let cursor = start;
  let html = '';
  for (const child of node.childNodes ?? []) {
    const childLocation = locationOf(child);
    if (!childLocation) continue;
    html += source.slice(cursor, childLocation.startOffset);
    html += render(child);
    cursor = childLocation.endOffset;
  }
  return html + source.slice(cursor, end);
}

function transformAdd(node: HtmlNode, active: boolean, state: TransformState): string {
  if (node.nodeName === '#text') {
    return splitText(node, active, state)
      .map((piece) => piece.selected && !piece.active ? `<${state.mark}>${piece.html}</${state.mark}>` : piece.html)
      .join('');
  }

  const length = textLength(node);
  const start = state.cursor;
  const end = start + length;
  const location = locationOf(node);
  if (!location || !selectionOverlaps(start, end, state.range)) {
    state.cursor = end;
    return rawNode(node, state.source);
  }
  if (!node.tagName || !location.startTag || !location.endTag) {
    state.cursor = end;
    return rawNode(node, state.source);
  }

  const nextActive = active || markAliases[state.mark].has(node.tagName.toLowerCase());
  const startTag = state.source.slice(location.startTag.startOffset, location.startTag.endOffset);
  const endTag = state.source.slice(location.endTag.startOffset, location.endTag.endOffset);
  const inner = appendChildren(node, (child) => transformAdd(child, nextActive, state), state.source);
  return `${startTag}${inner}${endTag}`;
}

function mergePieces(pieces: Piece[]): Piece[] {
  const merged: Piece[] = [];
  for (const piece of pieces) {
    if (!piece.html) continue;
    const previous = merged.at(-1);
    if (previous && previous.selected === piece.selected && previous.active === piece.active) previous.html += piece.html;
    else merged.push({ ...piece });
  }
  return merged;
}

function transformRemove(node: HtmlNode, inheritedActive: boolean, state: TransformState): Piece[] {
  if (node.nodeName === '#text') return splitText(node, inheritedActive, state);

  const length = textLength(node);
  const start = state.cursor;
  const end = start + length;
  const location = locationOf(node);
  const selectedAtBoundary = length === 0 && state.range.start <= start && start < state.range.end;
  if (!location || (!selectionOverlaps(start, end, state.range) && !selectedAtBoundary)) {
    state.cursor = end;
    return [{ html: rawNode(node, state.source), selected: false, active: inheritedActive }];
  }
  if (!node.tagName || !location.startTag || !location.endTag) {
    state.cursor = end;
    return [{ html: rawNode(node, state.source), selected: selectedAtBoundary, active: inheritedActive }];
  }

  const isMark = markAliases[state.mark].has(node.tagName.toLowerCase());
  const childPieces: Piece[] = [];
  let childCursor = location.startTag.endOffset;
  for (const child of node.childNodes ?? []) {
    const childLocation = locationOf(child);
    if (!childLocation) continue;
    if (childLocation.startOffset > childCursor) {
      childPieces.push({
        html: state.source.slice(childCursor, childLocation.startOffset),
        selected: state.range.start <= state.cursor && state.cursor < state.range.end,
        active: inheritedActive
      });
    }
    childPieces.push(...transformRemove(child, inheritedActive, state));
    childCursor = childLocation.endOffset;
  }
  if (childCursor < location.endTag.startOffset) {
    childPieces.push({
      html: state.source.slice(childCursor, location.endTag.startOffset),
      selected: state.range.start <= state.cursor && state.cursor < state.range.end,
      active: inheritedActive
    });
  }

  const startTag = state.source.slice(location.startTag.startOffset, location.startTag.endOffset);
  const endTag = state.source.slice(location.endTag.startOffset, location.endTag.endOffset);
  return mergePieces(mergePieces(childPieces).map((piece) => {
    if (isMark && piece.selected) return { ...piece, active: inheritedActive };
    return {
      html: `${startTag}${piece.html}${endTag}`,
      selected: piece.selected,
      active: isMark ? true : piece.active
    };
  }));
}

function selectionIsActive(nodes: readonly HtmlNode[], range: TextRange, mark: InlineMark): boolean {
  let cursor = 0;
  let selectedText = 0;
  let selectedInactiveText = 0;

  const visit = (node: HtmlNode, active: boolean): void => {
    if (node.nodeName === '#text') {
      const length = node.value?.length ?? 0;
      const start = cursor;
      const end = start + length;
      const overlap = Math.max(0, Math.min(end, range.end) - Math.max(start, range.start));
      selectedText += overlap;
      if (!active) selectedInactiveText += overlap;
      cursor = end;
      return;
    }
    const nextActive = active || Boolean(node.tagName && markAliases[mark].has(node.tagName.toLowerCase()));
    for (const child of node.childNodes ?? []) visit(child, nextActive);
  };

  for (const node of nodes) visit(node, false);
  if (range.start < 0 || range.end <= range.start || range.end > cursor) {
    throw new RichTextRangeError('The selected text range is outside the editable element.');
  }
  return selectedText > 0 && selectedInactiveText === 0;
}

export function toggleInlineMarkInHtml(source: string, range: TextRange, mark: InlineMark): InlineMarkTransform {
  const fragment = parseFragment(source, { sourceCodeLocationInfo: true }) as unknown as { childNodes: HtmlNode[] };
  const nodes = fragment.childNodes ?? [];
  const active = selectionIsActive(nodes, range, mark);
  const state: TransformState = { source, range, mark, cursor: 0 };
  const html = active
    ? mergePieces(nodes.flatMap((node) => transformRemove(node, false, state))).map((piece) => piece.html).join('')
    : nodes.map((node) => transformAdd(node, false, state)).join('');
  return { html, active, action: active ? 'remove' : 'add' };
}
