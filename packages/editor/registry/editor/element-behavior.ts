import type { NodeKey, ParsedNode } from '@visual-html/core';

export type ElementEditTarget = 'self' | 'nearest-rich-text-region';

export interface ElementBehavior {
  kind: string;
  editTarget: ElementEditTarget;
}

export interface ElementBehaviorContext {
  node: ParsedNode;
  nodes: ReadonlyMap<NodeKey, ParsedNode>;
}

export type ElementBehaviorResolver = (context: ElementBehaviorContext) => Partial<ElementBehavior> | undefined;

const transparentInlineTags = new Set([
  'span', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike', 'small', 'code', 'mark', 'br'
]);

const roleKinds: Readonly<Record<string, string>> = {
  button: 'Button',
  link: 'Link',
  heading: 'Heading',
  img: 'Image',
  table: 'Table',
  row: 'Row',
  cell: 'Cell'
};

function attributeValue(node: ParsedNode, name: string): string {
  return node.attributes.get(name)?.value ?? '';
}

function defaultKind(node: ParsedNode): string {
  const explicitRole = roleKinds[attributeValue(node, 'role').toLowerCase()];
  if (explicitRole) return explicitRole;
  if (node.tagName === 'button') return 'Button';
  if (node.tagName === 'a') return 'Link';
  if (node.tagName === 'table') return 'Table';
  if (node.tagName === 'tr') return 'Row';
  if (node.tagName === 'td' || node.tagName === 'th') return 'Cell';
  if (node.tagName === 'section') return 'Section';
  if (/^h[1-6]$/.test(node.tagName)) return 'Heading';
  if (node.tagName === 'img' || node.tagName === 'picture' || node.tagName === 'svg') return 'Image';
  if (['input', 'select', 'textarea'].includes(node.tagName)) return 'Control';
  if (!node.hasElementChildren && ['p', 'span', 'label', 'li', 'blockquote', 'strong', 'em', 'small', 'code', 'mark'].includes(node.tagName)) return 'Text';
  if (node.tagName.includes('-') || ['main', 'nav', 'header', 'footer', 'aside'].includes(node.tagName)) return 'Component';
  return 'Group';
}

export function resolveElementBehavior(
  node: ParsedNode,
  nodes: ReadonlyMap<NodeKey, ParsedNode>,
  resolvers: readonly ElementBehaviorResolver[] = []
): ElementBehavior {
  let behavior: ElementBehavior = {
    kind: defaultKind(node),
    editTarget: transparentInlineTags.has(node.tagName) ? 'nearest-rich-text-region' : 'self'
  };
  const context = { node, nodes };
  for (const resolver of resolvers) {
    const override = resolver(context);
    if (override) behavior = { ...behavior, ...override };
  }
  return behavior;
}
