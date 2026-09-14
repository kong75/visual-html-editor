import { describe, expect, it } from 'vitest';
import { richTextSourceEdits, setInlineStylesInHtml, toggleInlineMarkInHtml } from './rich-text.js';

describe('source-preserving inline marks', () => {
  it('wraps a selected portion of plain text', () => {
    expect(toggleInlineMarkInHtml('Hello world', { start: 6, end: 11 }, 'strong')).toEqual({
      html: 'Hello <strong>world</strong>',
      active: false,
      action: 'add'
    });
  });

  it('preserves nested inline markup while applying a mark across it', () => {
    expect(toggleInlineMarkInHtml('Hello <em>big world</em>!', { start: 0, end: 9 }, 'strong').html).toBe(
      '<strong>Hello </strong><em><strong>big</strong> world</em>!'
    );
  });

  it('removes a mark from part of an already marked range', () => {
    expect(toggleInlineMarkInHtml('Hello <strong>bold world</strong>!', { start: 6, end: 10 }, 'strong').html).toBe(
      'Hello bold<strong> world</strong>!'
    );
  });

  it('balances nested tags when removing a mark from a partial range', () => {
    expect(toggleInlineMarkInHtml('<strong><em>hello world</em></strong>', { start: 6, end: 11 }, 'strong').html).toBe(
      '<strong><em>hello </em></strong><em>world</em>'
    );
  });

  it('preserves HTML character references at text boundaries', () => {
    expect(toggleInlineMarkInHtml('A &amp; B', { start: 2, end: 3 }, 'strong').html).toBe(
      'A <strong>&amp;</strong> B'
    );
  });
});

describe('source-preserving inline styles', () => {
  it('styles only the selected portion of plain text', () => {
    expect(setInlineStylesInHtml('Hello world', { start: 6, end: 11 }, {
      'font-size': '24px', color: '#7c3aed'
    }).html).toBe('Hello <span style="font-size: 24px; color: #7c3aed">world</span>');
  });

  it('preserves nested inline markup and character references', () => {
    expect(setInlineStylesInHtml('A &amp; <em>beautiful</em> world', { start: 2, end: 13 }, {
      'letter-spacing': '0.04em'
    }).html).toBe(
      'A <span style="letter-spacing: 0.04em">&amp; </span><em><span style="letter-spacing: 0.04em">beautiful</span></em> world'
    );
  });

  it('updates a fully selected style span instead of nesting another span', () => {
    expect(setInlineStylesInHtml(
      '<span class="accent" style="color: red">Hello</span> world',
      { start: 0, end: 5 },
      { color: 'blue', 'font-size': '20px' }
    ).html).toBe('<span class="accent" style="color: blue; font-size: 20px">Hello</span> world');
  });

  it('keeps unselected text in an existing span unchanged', () => {
    expect(setInlineStylesInHtml(
      '<span style="color: red">Hello world</span>',
      { start: 6, end: 11 },
      { color: 'blue' }
    ).html).toBe('<span style="color: red">Hello <span style="color: blue">world</span></span>');
  });
});

describe('source-preserving rich-text wording edits', () => {
  it('ignores browser serialization differences when the content is unchanged', () => {
    expect(richTextSourceEdits(
      "Hello <em class='accent'>beautiful</em> &amp; friends.",
      'Hello <em class="accent">beautiful</em> &amp; friends.'
    )).toEqual([]);
  });

  it('returns minimal escaped text replacements when structure is unchanged', () => {
    const source = "Hello <em class='accent'>beautiful</em> world &amp; friends.";
    const edits = richTextSourceEdits(
      source,
      'Hello <em class="accent">wonderful</em> world &amp; &lt;teammates&gt;.'
    );
    expect(edits).not.toBeNull();
    const next = [...edits!]
      .sort((left, right) => right.start - left.start)
      .reduce((html, edit) => html.slice(0, edit.start) + edit.replacement + html.slice(edit.end), source);
    expect(next).toBe("Hello <em class='accent'>wonderful</em> world &amp; &lt;teammates&gt;.");
  });

  it('falls back when the edited element structure changes', () => {
    expect(richTextSourceEdits('Hello <em>world</em>', 'Hello <strong>world</strong>')).toBeNull();
  });
});
