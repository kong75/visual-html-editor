/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { layoutSize } from './geometry.js';

afterEach(() => document.body.replaceChildren());

function element(style: string) {
  const node = document.createElement('div');
  node.style.cssText = style;
  document.body.append(node);
  // jsdom has no layout engine; supply measured browser dimensions.
  Object.defineProperties(node, { offsetWidth: { value: 235 }, offsetHeight: { value: 113 } });
  return node;
}

describe('layout sizing', () => {
  it('uses fractional CSS dimensions without including padding or borders again', () => {
    const node = element('width:120.5px;height:80.25px;padding:10px;border:2px solid;box-sizing:content-box');
    expect(layoutSize(node)).toEqual({ width: 120.5, height: 80.25 });
  });

  it('subtracts asymmetric padding and borders from automatic content-box dimensions', () => {
    const node = element('width:auto;height:auto;padding:4px 20px 6px 10px;border-style:solid;border-width:1px 3px 2px 2px;box-sizing:content-box');
    expect(layoutSize(node)).toEqual({ width: 200, height: 100 });
  });

  it('keeps padding and borders in automatic border-box dimensions', () => {
    const node = element('width:auto;height:auto;padding:10px;border:2px solid;box-sizing:border-box');
    expect(layoutSize(node)).toEqual({ width: 235, height: 113 });
  });
});
