import { describe, expect, it } from 'vitest';
import {
  EditorController,
  toggleInlineMarkInHtml,
  webProfile,
  type InlineMark
} from '../../packages/core/src/index.js';
import { createRandom, integer, pick } from '../support/deterministic-random.js';

interface Atom {
  html: string;
  text: string;
}

const atoms: readonly Atom[] = [
  { html: 'alpha', text: 'alpha' },
  { html: ' beta', text: ' beta' },
  { html: ' &amp; ', text: ' & ' },
  { html: '&copy;', text: '©' },
  { html: ' clarity', text: ' clarity' },
  { html: '😀', text: '😀' },
  { html: ' {{first_name}}', text: ' {{first_name}}' },
  { html: ' [[course_title]]', text: ' [[course_title]]' },
  { html: ' end.', text: ' end.' }
];

const wrappers = [
  { open: '<em>', close: '</em>' },
  { open: '<strong>', close: '</strong>' },
  { open: '<span class="tone">', close: '</span>' },
  { open: '<a href="{{url}}">', close: '</a>' },
  { open: '<code>', close: '</code>' }
] as const;

const marks: readonly InlineMark[] = ['strong', 'em', 'u', 's'];

function wrap(random: () => number, atom: Atom): Atom {
  let html = atom.html;
  const depth = integer(random, 0, 2);
  for (let index = 0; index < depth; index += 1) {
    const wrapper = pick(random, wrappers);
    html = `${wrapper.open}${html}${wrapper.close}`;
  }
  return { html, text: atom.text };
}

function textBoundaries(text: string): number[] {
  const offsets = [0];
  let offset = 0;
  for (const character of text) {
    offset += character.length;
    offsets.push(offset);
  }
  return offsets;
}

function generatedInlineHtml(seed: number): { html: string; text: string; mark: InlineMark; start: number; end: number } {
  const random = createRandom(seed);
  const count = integer(random, 3, 8);
  const pieces = Array.from({ length: count }, () => wrap(random, pick(random, atoms)));
  const html = pieces.map((piece) => piece.html).join('');
  const text = pieces.map((piece) => piece.text).join('');
  const boundaries = textBoundaries(text);
  const startIndex = integer(random, 0, boundaries.length - 2);
  const endIndex = integer(random, startIndex + 1, boundaries.length - 1);
  return { html, text, mark: pick(random, marks), start: boundaries[startIndex], end: boundaries[endIndex] };
}

describe('rich-text deterministic property suite', () => {
  it('preserves rendered text, produces parseable HTML, and flips mark state for 250 generated cases', async () => {
    for (let seed = 1; seed <= 250; seed += 1) {
      const sample = generatedInlineHtml(seed);
      try {
        const first = toggleInlineMarkInHtml(sample.html, { start: sample.start, end: sample.end }, sample.mark);
        const second = toggleInlineMarkInHtml(first.html, { start: sample.start, end: sample.end }, sample.mark);
        expect(second.action).not.toBe(first.action);

        const controller = await EditorController.create({
          html: `<p id="subject">${first.html}</p>`,
          profile: webProfile
        });
        const paragraph = controller.getSnapshot().nodes.find((node) => node.attributes.get('id')?.value === 'subject');
        expect(paragraph?.textContent).toBe(sample.text);
        expect(controller.getSnapshot().issues.filter((issue) => issue.severity === 'blocking')).toEqual([]);
        expect((await controller.export()).html).not.toContain('data-vhe-node');
      } catch (error) {
        throw new Error(`Rich-text property failed for deterministic seed ${seed}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    }
  });

  it('restores exact source through controller undo for representative generated cases', async () => {
    for (let seed = 1001; seed <= 1050; seed += 1) {
      const sample = generatedInlineHtml(seed);
      const source = `<p id="subject">${sample.html}</p>`;
      const controller = await EditorController.create({ html: source, profile: webProfile });
      const paragraph = controller.getSnapshot().nodes.find((node) => node.attributes.get('id')?.value === 'subject');
      if (!paragraph) throw new Error(`Missing generated paragraph for seed ${seed}`);

      const result = await controller.dispatch({
        type: 'toggleInlineMark',
        nodeKey: paragraph.key,
        range: { start: sample.start, end: sample.end },
        mark: sample.mark
      });
      expect(result.ok).toBe(true);
      expect((await controller.undo()).ok).toBe(true);
      expect((await controller.export()).html).toBe(source);
    }
  });
});
