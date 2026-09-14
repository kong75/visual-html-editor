import { describe, expect, it } from 'vitest';
import type { ParsedNode } from '@visual-html/core';
import { resolveElementBehavior, type ElementBehaviorResolver } from './element-behavior';

function node(tagName: string, options: Partial<ParsedNode> = {}): ParsedNode {
  return {
    key: `node-${tagName}`,
    revision: 0,
    fileId: 'index.html',
    tagName,
    attributes: new Map(),
    childKeys: [],
    hasElementChildren: false,
    textContent: '',
    virtual: false,
    ...options
  };
}

describe('resolveElementBehavior', () => {
  it('keeps native interactive elements atomic without styling heuristics', () => {
    const link = node('a');
    expect(resolveElementBehavior(link, new Map([[link.key, link]]))).toEqual({ kind: 'Link', editTarget: 'self' });
  });

  it('delegates transparent formatting elements to the nearest rich-text region', () => {
    const strong = node('strong');
    expect(resolveElementBehavior(strong, new Map([[strong.key, strong]]))).toEqual({ kind: 'Text', editTarget: 'nearest-rich-text-region' });
  });

  it('supports host-defined semantic and editing overrides', () => {
    const link = node('a', { attributes: new Map([['data-component', { name: 'data-component', value: 'cta' }]]) });
    const resolver: ElementBehaviorResolver = ({ node: candidate }) => candidate.attributes.get('data-component')?.value === 'cta'
      ? { kind: 'Call to action', editTarget: 'self' }
      : undefined;
    expect(resolveElementBehavior(link, new Map([[link.key, link]]), [resolver]))
      .toEqual({ kind: 'Call to action', editTarget: 'self' });
  });
});
