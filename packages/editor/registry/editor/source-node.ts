import type { ParsedNode } from '@visual-html/core';

export function attributeValue(node: ParsedNode | undefined, name: string): string {
  return node?.attributes.get(name)?.value ?? '';
}
