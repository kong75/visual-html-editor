import { describe, expect, it } from 'vitest';
import { setInlineStyleProperty } from './inline-style';

describe('setInlineStyleProperty', () => {
  it('accepts semicolons inside CSS strings and functions but rejects extra declarations', () => {
    expect(setInlineStyleProperty('', 'background-image', 'url("data:image/png;base64,AA")'))
      .toBe('background-image: url("data:image/png;base64,AA")');
    expect(setInlineStyleProperty('', 'color', 'blue !important;')).toBe('color: blue !important');
    expect(() => setInlineStyleProperty('', 'color', 'red; position: absolute')).toThrow(/exactly one/);
  });

  it('writes an edited longhand after an earlier shorthand so the edit wins', () => {
    expect(setInlineStyleProperty('display: inline-block; background: #007ee5; color: white', 'background-color', '#d946ef'))
      .toBe('display: inline-block; background: #007ee5; color: white; background-color: #d946ef');
  });

  it('moves an existing property after later declarations to preserve CSS cascade intent', () => {
    expect(setInlineStyleProperty('border-color: red; border: 2px solid blue; color: white', 'border-color', 'green'))
      .toBe('border: 2px solid blue; color: white; border-color: green');
  });

  it('preserves importance and removes duplicate declarations generically', () => {
    expect(setInlineStyleProperty('color: red !important; padding: 4px; color: blue', 'color', 'green'))
      .toBe('padding: 4px; color: green !important');
  });

  it('removes only the edited property when resetting it', () => {
    expect(setInlineStyleProperty('background: red; background-color: blue; color: white', 'background-color', null))
      .toBe('background: red; color: white');
  });
});
