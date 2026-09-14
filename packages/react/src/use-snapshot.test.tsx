/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EditorController, webProfile } from '@visual-html/core';
import { DeckController, type HtmlDeck } from '@visual-html/deck';
import { useDeckSnapshot } from './use-deck-snapshot';
import { useEditorSnapshot } from './use-editor-snapshot';

const deck: HtmlDeck = {
  schema: 'visual-html-deck',
  version: 1,
  id: 'snapshot-test',
  width: 1600,
  height: 900,
  slides: [
    { id: 'one', html: '<p>One</p>' },
    { id: 'two', html: '<p>Two</p>' }
  ]
};

describe('external store snapshot hooks', () => {
  it('subscribes to editor state through React external-store semantics', async () => {
    const controller = await EditorController.create({ html: '<p>One</p>', profile: webProfile });
    const { result } = renderHook(() => useEditorSnapshot(controller));
    const initial = result.current;

    await act(() => controller.replaceSource('<p>Two</p>'));

    expect(result.current).not.toBe(initial);
    expect(result.current.html).toBe('<p>Two</p>');
    expect(result.current).toBe(controller.getSnapshot());
  });

  it('subscribes to deck state through React external-store semantics', async () => {
    const controller = await DeckController.create({ deck });
    const { result } = renderHook(() => useDeckSnapshot(controller));
    const initial = result.current;

    act(() => { controller.setActiveSlide('two'); });

    expect(result.current).not.toBe(initial);
    expect(result.current.activeSlideId).toBe('two');
    expect(result.current).toBe(controller.getSnapshot());
  });
});
