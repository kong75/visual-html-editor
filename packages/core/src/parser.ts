import { parse, parseFragment } from 'parse5';
import type {
  DocumentIndex,
  FileId,
  NodeKey,
  ParsedAttribute,
  ParsedNode,
  SourcePatch,
  SourceRange
} from './types.js';

interface ParseOptions {
  revision: number;
  fileId: FileId;
  previousIndex?: DocumentIndex;
  patches?: readonly SourcePatch[];
  allocateKey: () => NodeKey;
}

interface MutableParsedNode {
  key: NodeKey;
  revision: number;
  fileId: FileId;
  tagName: string;
  range?: SourceRange;
  startTagRange?: SourceRange;
  endTagRange?: SourceRange;
  innerRange?: SourceRange;
  attributes: Map<string, ParsedAttribute>;
  parentKey?: NodeKey;
  childKeys: NodeKey[];
  hasElementChildren: boolean;
  textContent: string;
  virtual: boolean;
}

// These HTML elements may end implicitly at a sibling, parent end tag, or EOF.
// Void elements and unfinished non-optional tags must not gain an inner range.
const optionalEndTags = new Set([
  'html', 'head', 'body', 'p', 'li', 'dt', 'dd', 'rt', 'rp', 'optgroup', 'option',
  'colgroup', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'
]);

function hasDocumentStructure(document: any): boolean {
  if (document.childNodes.some((node: any) => node.nodeName === '#documentType')) return true;
  const html = document.childNodes.find((node: any) => node.tagName === 'html');
  // Attributes can be authored on a later <body>/<html> tag even when the
  // parser already created an implied wrapper without a source location.
  const authored = (node: any): boolean => Boolean(node?.sourceCodeLocation || node?.attrs?.length);
  return authored(html) || Boolean(html?.childNodes.some((node: any) =>
    ['head', 'body'].includes(node.tagName) && authored(node)));
}

function toRange(location: { startOffset: number; endOffset: number } | undefined): SourceRange | undefined {
  return location
    ? { start: location.startOffset, end: location.endOffset }
    : undefined;
}

function translateOffset(offset: number, patches: readonly SourcePatch[]): number {
  let translated = offset;
  const sorted = [...patches].sort((left, right) => left.start - right.start);
  for (const patch of sorted) {
    if (offset < patch.start) break;
    if (offset >= patch.end) {
      translated += patch.replacement.length - (patch.end - patch.start);
      continue;
    }
    return patch.start + Math.min(offset - patch.start, patch.replacement.length);
  }
  return translated;
}

function collectText(node: any): string {
  if (node.nodeName === '#text') return node.value ?? '';
  return (node.childNodes ?? []).map((child: any) => collectText(child)).join('');
}

function buildPreviousLookup(
  previousIndex: DocumentIndex | undefined,
  patches: readonly SourcePatch[]
): Map<string, NodeKey[]> {
  const lookup = new Map<string, NodeKey[]>();
  if (!previousIndex) return lookup;

  for (const node of previousIndex.nodes.values()) {
    if (!node.range || node.virtual) continue;
    // A start tag removed by a replacement no longer identifies a surviving
    // node. Its translated offset may now belong to the following sibling.
    if (patches.some((patch) => patch.start <= node.range!.start && patch.end > node.range!.start)) continue;
    const translatedStart = translateOffset(node.range.start, patches);
    const signature = `${node.tagName}:${translatedStart}`;
    const keys = lookup.get(signature) ?? [];
    keys.push(node.key);
    lookup.set(signature, keys);
  }
  return lookup;
}

export function parseHtmlSource(source: string, options: ParseOptions): DocumentIndex {
  const document = parse(source, { sourceCodeLocationInfo: true });
  const fragment = !hasDocumentStructure(document);
  const tree: any = fragment
    ? parseFragment(source, { sourceCodeLocationInfo: true })
    : document;
  const patches = options.patches?.filter((patch) => patch.fileId === options.fileId) ?? [];
  const previousLookup = buildPreviousLookup(options.previousIndex, patches);
  const usedPreviousKeys = new Set<NodeKey>();
  const nodes = new Map<NodeKey, MutableParsedNode>();
  const rootKeys: NodeKey[] = [];

  const visit = (rawNode: any, parentKey?: NodeKey): void => {
    let currentParentKey = parentKey;
    if (typeof rawNode.tagName === 'string') {
      const location = rawNode.sourceCodeLocation;
      const range = toRange(location);
      const tagName = rawNode.tagName.toLowerCase();
      let key: NodeKey | undefined;

      if (range) {
        const signature = `${tagName}:${range.start}`;
        const candidates = previousLookup.get(signature) ?? [];
        key = candidates.find((candidate) => !usedPreviousKeys.has(candidate));
      }
      if (!key) key = options.allocateKey();
      usedPreviousKeys.add(key);

      const attributes = new Map<string, ParsedAttribute>();
      const attributeLocations = location?.attrs ?? {};
      for (const attribute of rawNode.attrs ?? []) {
        attributes.set(attribute.name, {
          name: attribute.name,
          value: attribute.value,
          range: toRange(attributeLocations[attribute.name])
        });
      }

      const startTagRange = toRange(location?.startTag ?? location);
      const endTagRange = toRange(location?.endTag);
      const innerEnd = endTagRange?.start ?? (optionalEndTags.has(tagName) ? range?.end : undefined);
      const innerRange = startTagRange && innerEnd !== undefined && innerEnd >= startTagRange.end
        ? { start: startTagRange.end, end: innerEnd }
        : undefined;

      const childElements = (rawNode.childNodes ?? []).filter(
        (child: any) => typeof child.tagName === 'string'
      );
      const parsedNode: MutableParsedNode = {
        key,
        revision: options.revision,
        fileId: options.fileId,
        tagName,
        range,
        startTagRange,
        endTagRange,
        innerRange,
        attributes,
        parentKey,
        childKeys: [],
        hasElementChildren: childElements.length > 0,
        textContent: collectText(rawNode),
        virtual: !range
      };
      nodes.set(key, parsedNode);
      if (parentKey) nodes.get(parentKey)?.childKeys.push(key);
      else rootKeys.push(key);
      currentParentKey = key;
    }

    for (const child of rawNode.childNodes ?? []) visit(child, currentParentKey);
  };

  visit(tree);

  return {
    revision: options.revision,
    isFragment: fragment,
    nodes: new Map<NodeKey, ParsedNode>(nodes),
    rootKeys
  };
}
