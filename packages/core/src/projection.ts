import MagicString from 'magic-string';
import type { DocumentIndex, RuntimeProjection } from './types.js';
import { attributeInsertionPoint } from './source-attributes.js';

export const RUNTIME_NODE_ATTRIBUTE = 'data-vhe-node';

function fragmentContext(index: DocumentIndex): [string, string] {
  const tags = index.rootKeys.map((key) => index.nodes.get(key)?.tagName);
  if (tags.some((tag) => tag === 'td' || tag === 'th')) return ['<table><tbody><tr>', '</tr></tbody></table>'];
  if (tags.includes('tr')) return ['<table><tbody>', '</tbody></table>'];
  if (tags.includes('col')) return ['<table><colgroup>', '</colgroup></table>'];
  if (tags.some((tag) => ['thead', 'tbody', 'tfoot', 'caption', 'colgroup'].includes(tag ?? ''))) return ['<table>', '</table>'];
  return ['', ''];
}

export function buildRuntimeProjection(
  source: string,
  index: DocumentIndex
): RuntimeProjection {
  const magic = new MagicString(source);
  const authoredAttributes = [...index.nodes.values()].flatMap((node) => [...node.attributes.keys()]);
  let prefix = 'data-vhe-';
  let suffix = 0;
  while (authoredAttributes.some((name) => name.startsWith(prefix))) prefix = `data-vhe-${++suffix}-`;
  const runtimeAttribute = `${prefix}node`;
  for (const node of index.nodes.values()) {
    if (node.virtual || !node.startTagRange) continue;
    const point = attributeInsertionPoint(source, node)!;
    magic.appendLeft(point, ` ${runtimeAttribute}="${node.key}"`);
  }

  const instrumented = magic.toString();
  const [before, after] = fragmentContext(index);
  const html = index.isFragment
    ? `<!doctype html><html><head></head><body>${before}${instrumented}${after}</body></html>`
    : instrumented;

  return {
    revision: index.revision,
    html,
    runtimeAttribute
  };
}
