import type { DocumentIndex, ParsedNode } from './types.js';

const idReferences = new Set([
  'for', 'form', 'list', 'headers', 'itemref', 'aria-labelledby', 'aria-describedby',
  'aria-controls', 'aria-owns', 'aria-flowto', 'aria-activedescendant', 'aria-details',
  'aria-errormessage', 'popovertarget', 'commandfor'
]);
const fragmentUrlAttributes = new Set(['style', 'fill', 'stroke', 'filter', 'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end']);

/** Only the copied subtree changes; references outside it keep their original targets. */
export function duplicateSource(source: string, root: ParsedNode, index: DocumentIndex): string {
  const range = root.range!;
  const descendants = [...index.nodes.values()].filter((node) => !node.virtual && node.fileId === root.fileId
    && node.range && node.range.start >= range.start && node.range.end <= range.end);
  const usedIds = new Set([...index.nodes.values()].map((node) => node.attributes.get('id')?.value).filter(Boolean));
  const references = new Map<string, string>();
  const nodeIds = new Map<string, string>();
  for (const node of descendants) {
    const id = node.attributes.get('id')?.value;
    if (!id) continue;
    let suffix = 1;
    let next = `${id}-copy`;
    while (usedIds.has(next)) next = `${id}-copy-${++suffix}`;
    usedIds.add(next);
    nodeIds.set(node.key, next);
    if (!references.has(id)) references.set(id, next);
  }

  const edits: Array<{ start: number; end: number; value: string }> = [];
  for (const node of descendants) {
    for (const [name, attribute] of node.attributes) {
      if (!attribute.range) continue;
      let value = attribute.value;
      if (name === 'id') value = nodeIds.get(node.key) ?? value;
      else if (idReferences.has(name)) value = value.replace(/\S+/g, (id) => references.get(id) ?? id);
      else if ((name === 'href' || name === 'xlink:href') && value.startsWith('#')) {
        let target = value.slice(1);
        try { target = decodeURIComponent(target); } catch { /* Keep malformed authored fragments unchanged. */ }
        const renamed = references.get(target);
        if (renamed) value = `#${encodeURIComponent(renamed)}`;
      } else if (fragmentUrlAttributes.has(name)) {
        // Local SVG paint servers and inline CSS fragment URLs, never remote URLs.
        value = value.replace(/url\(\s*(['"]?)#([^\s'"()]+)\1\s*\)/gi, (match, quote: string, id: string) => {
          const renamed = references.get(id);
          return renamed ? `url(${quote}#${renamed}${quote})` : match;
        });
      }
      if (value === attribute.value) continue;
      const escaped = value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
      edits.push({ start: attribute.range.start - range.start, end: attribute.range.end - range.start, value: `${name}="${escaped}"` });
    }
  }
  let copied = source.slice(range.start, range.end);
  for (const edit of edits.sort((a, b) => b.start - a.start)) copied = copied.slice(0, edit.start) + edit.value + copied.slice(edit.end);
  return copied;
}
