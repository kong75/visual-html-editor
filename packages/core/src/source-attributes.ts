import type { ParsedNode } from './types.js';

export function attributeInsertionPoint(source: string, node: ParsedNode): number | undefined {
  const tag = node.startTagRange;
  if (!tag) return undefined;
  // In <img src=folder/>, the slash belongs to the unquoted value. Insert
  // after the parsed tag name for compact /> endings rather than guessing
  // whether the final slash is an attribute character or a closing marker.
  return source.slice(tag.end - 2, tag.end) === '/>'
    ? tag.start + 1 + node.tagName.length
    : tag.end - 1;
}
