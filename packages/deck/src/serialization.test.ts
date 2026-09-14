import { describe, expect, it } from 'vitest';
import { cloneSlide, createBlankSlideHtml, normalizeDeck, parseDeck, serializeDeck } from './serialization';
import type { HtmlDeck } from './types';

function validDeck(): HtmlDeck {
  return {
    schema: 'visual-html-deck',
    version: 1,
    id: 'deck',
    width: 1280,
    height: 720,
    slides: [{ id: 'one', html: '<h1>One</h1>', metadata: { source: 'test' } }],
    metadata: { theme: 'light' }
  };
}

describe('deck serialization and normalization', () => {
  it.each([
    [{ ...validDeck(), schema: 'other' }, /schema or version/],
    [{ ...validDeck(), version: 2 }, /schema or version/],
    [{ ...validDeck(), id: '   ' }, /id is required/],
    [{ ...validDeck(), width: 0 }, /dimensions/],
    [{ ...validDeck(), width: Number.POSITIVE_INFINITY }, /dimensions/],
    [{ ...validDeck(), height: Number.NaN }, /dimensions/],
    [{ ...validDeck(), slides: [] }, /at least one slide/],
    [{ ...validDeck(), slides: [{ id: ' ', html: '<p>x</p>' }] }, /slide must have an id/],
    [{ ...validDeck(), slides: [{ id: 'same', html: 'a' }, { id: 'same', html: 'b' }] }, /Duplicate slide id/],
    [{ ...validDeck(), slides: [{ id: 'one', html: 42 }] }, /must contain HTML source/]
  ])('rejects invalid deck data', (candidate, message) => {
    expect(() => normalizeDeck(candidate as HtmlDeck)).toThrow(message);
  });

  it('defensively clones deck and slide metadata', () => {
    const input = validDeck();
    const normalized = normalizeDeck(input);
    const cloned = cloneSlide(input.slides[0]);
    expect(normalized).not.toBe(input);
    expect(normalized.slides).not.toBe(input.slides);
    expect(normalized.metadata).not.toBe(input.metadata);
    expect(normalized.slides[0].metadata).not.toBe(input.slides[0].metadata);
    expect(cloned.metadata).not.toBe(input.slides[0].metadata);
    expect(cloneSlide({ id: 'plain', html: 'x' }).metadata).toBeUndefined();
  });

  it('creates escaped, dimension-aware blank slide HTML', () => {
    const small = createBlankSlideHtml(400, 300, '<New & "quoted">');
    const large = createBlankSlideHtml(1600, 900, "Leader's view");
    expect(small).toContain('<title>&lt;New &amp; &quot;quoted&quot;&gt;</title>');
    expect(small).toContain('font-size: 40px');
    expect(small).toContain('min-height: 300px');
    expect(large).toContain('font-size: 80px');
    expect(large).toContain('Leader&#39;s view');
  });

  it('round-trips with configurable indentation and rejects invalid JSON', () => {
    const encoded = serializeDeck(validDeck(), 0);
    expect(encoded).not.toContain('\n');
    expect(parseDeck(encoded)).toEqual(validDeck());
    expect(() => parseDeck('{bad json')).toThrow();
  });
});
