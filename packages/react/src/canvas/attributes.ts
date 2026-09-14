import { RUNTIME_NODE_ATTRIBUTE } from '@visual-html/core';

function attributeNames(node: string) {
  const prefix = node.slice(0, -'node'.length);
  return {
    node,
    editing: `${prefix}editing`,
    richRegion: `${prefix}rich-region`,
    selected: `${prefix}selected`,
    interaction: `${prefix}interaction`,
    dragging: `${prefix}dragging`,
    dragActive: `${prefix}drag-active`,
    runtime: `${prefix}runtime`
  };
}

const defaults = attributeNames(RUNTIME_NODE_ATTRIBUTE);
const documents = new WeakMap<Document, ReturnType<typeof attributeNames>>();

export function bindRuntimeAttributes(doc: Document, nodeAttribute: string) {
  const attributes = attributeNames(nodeAttribute);
  documents.set(doc, attributes);
  return attributes;
}

export function runtimeAttributes(doc: Document) {
  return documents.get(doc) ?? defaults;
}

export function sourceRichTextHtml(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  const names = Object.values(runtimeAttributes(element.ownerDocument));
  for (const descendant of clone.querySelectorAll('*')) {
    for (const name of names) descendant.removeAttribute(name);
  }
  return clone.innerHTML;
}
