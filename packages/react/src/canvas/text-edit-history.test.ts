/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextEditHistory } from './text-edit-history.js';

function caret(node: Node, offset: number) {
  document.getSelection()!.setBaseAndExtent(node, offset, node, offset);
}

function fixture(html = 'A') {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  return { root, history: new TextEditHistory(root) };
}

function input(root: HTMLElement, history: TextEditHistory, html: string, kind = 'insertText') {
  history.before(kind);
  root.innerHTML = html;
  caret(root.firstChild!, root.textContent!.length);
  history.after();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

describe('local text edit history', () => {
  it('ignores unchanged input and unmatched after notifications', () => {
    const { root, history } = fixture();
    history.after();
    history.before('insertText');
    history.after();
    expect(history.canUndo).toBe(false);
    expect(history.undo()).toBe(false);
    expect(history.redo()).toBe(false);
    expect(root.innerHTML).toBe('A');
  });

  it('groups continuous typing and restores both text and caret through undo and redo', () => {
    const { root, history } = fixture();
    caret(root.firstChild!, 1);
    input(root, history, 'AB');
    vi.setSystemTime(Date.now() + 200);
    input(root, history, 'ABC');

    expect(history.undo()).toBe(true);
    expect(root.innerHTML).toBe('A');
    expect(document.getSelection()?.anchorOffset).toBe(1);
    expect(history.canUndo).toBe(false);
    expect(history.redo()).toBe(true);
    expect(root.innerHTML).toBe('ABC');
    expect(document.getSelection()?.anchorOffset).toBe(3);
    expect(history.canRedo).toBe(false);
  });

  it.each(['pause', 'caret move', 'input kind'] as const)('starts another undo entry after a %s', (boundary) => {
    const { root, history } = fixture();
    caret(root.firstChild!, 1);
    input(root, history, 'AB');
    if (boundary === 'pause') vi.setSystemTime(Date.now() + 1000);
    if (boundary === 'caret move') caret(root.firstChild!, 0);
    input(root, history, boundary === 'caret move' ? 'CAB' : 'ABC', boundary === 'input kind' ? 'insertFromPaste' : 'insertText');

    expect(history.undo()).toBe(true);
    expect(root.innerHTML).toBe('AB');
    expect(history.undo()).toBe(true);
    expect(root.innerHTML).toBe('A');
  });

  it('restores a backward selection across nested formatting', () => {
    const html = '<strong>Alpha</strong><em>Beta</em>';
    const { root, history } = fixture(html);
    document.getSelection()!.setBaseAndExtent(root.lastChild!.firstChild!, 3, root.firstChild!.firstChild!, 1);
    input(root, history, 'new', 'insertFromPaste');

    expect(history.undo()).toBe(true);
    expect(root.innerHTML).toBe(html);
    const selection = document.getSelection()!;
    expect(selection.anchorNode?.textContent).toBe('Beta');
    expect(selection.anchorOffset).toBe(3);
    expect(selection.focusNode?.textContent).toBe('Alpha');
    expect(selection.focusOffset).toBe(1);
    expect(selection.toString()).toBe('lphaBet');
    expect(history.redo()).toBe(true);
    expect(root.innerHTML).toBe('new');
  });

  it('discards the redo branch after a new edit', () => {
    const { root, history } = fixture();
    input(root, history, 'AB', 'insertFromPaste');
    input(root, history, 'ABC', 'insertFromPaste');
    history.undo();
    input(root, history, 'ABD', 'insertFromPaste');

    expect(history.canRedo).toBe(false);
    expect(history.redo()).toBe(false);
    history.undo();
    expect(root.innerHTML).toBe('AB');
    history.undo();
    expect(root.innerHTML).toBe('A');
  });

  it('keeps the first snapshot during repeated composition notifications', () => {
    const { root, history } = fixture();
    history.before('insertCompositionText');
    root.textContent = 'あ';
    history.before('insertCompositionText');
    root.textContent = 'あい';
    history.after();

    history.undo();
    expect(root.textContent).toBe('A');
    expect(history.canUndo).toBe(false);
    history.redo();
    expect(root.textContent).toBe('あい');
  });

  it('captures pending input before undo even when the selection is outside the root', () => {
    const { root, history } = fixture();
    const outside = document.createElement('p');
    outside.textContent = 'Outside';
    document.body.append(outside);
    caret(outside.firstChild!, 2);
    history.before('insertText');
    root.textContent = 'AB';

    expect(history.undo()).toBe(true);
    expect(root.textContent).toBe('A');
    expect(document.getSelection()?.anchorNode).toBe(outside.firstChild);
    expect(history.redo()).toBe(true);
    expect(root.textContent).toBe('AB');
  });
});
