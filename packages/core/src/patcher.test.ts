import { describe, expect, it } from 'vitest';
import { hashText } from './hash';
import { applySourcePatches, createWorkspace, PatchConflictError } from './patcher';
import type { SourceFile, SourcePatch, WorkspaceSnapshot } from './types';

function patch(start: number, end: number, source: string, replacement: string, fileId = 'index.html'): SourcePatch {
  return { fileId, start, end, expectedHash: hashText(source.slice(start, end)), replacement };
}

describe('source patch transactions', () => {
  it('creates a canonical HTML workspace and named conflict errors', () => {
    const workspace = createWorkspace('<p>x</p>');
    expect(workspace.files.get('index.html')).toMatchObject({
      id: 'index.html',
      path: 'index.html',
      mediaType: 'text/html',
      content: '<p>x</p>',
      contentHash: hashText('<p>x</p>')
    });
    expect(new PatchConflictError('conflict')).toMatchObject({ name: 'PatchConflictError', message: 'conflict' });
  });

  it('applies unordered edits atomically and produces exact inverse patches', () => {
    const source = '<p>Hello world</p>';
    const workspace = createWorkspace(source);
    const applied = applySourcePatches(workspace, [
      patch(9, 14, source, 'editor'),
      patch(2, 2, source, ' class="lead"')
    ]);

    expect(applied.workspace.files.get('index.html')?.content).toBe('<p class="lead">Hello editor</p>');
    expect(workspace.files.get('index.html')?.content).toBe(source);
    expect(applied.workspace.revision).toBe(1);

    const restored = applySourcePatches(applied.workspace, applied.inversePatches);
    expect(restored.workspace.files.get('index.html')?.content).toBe(source);
  });

  it.each([
    { name: 'negative start', change: { start: -1, end: 0, expectedHash: hashText(''), replacement: '' }, message: /outside/ },
    { name: 'reversed range', change: { start: 4, end: 3, expectedHash: hashText(''), replacement: '' }, message: /outside/ },
    { name: 'range past end', change: { start: 0, end: 99, expectedHash: hashText(''), replacement: '' }, message: /outside/ },
    { name: 'stale hash', change: { start: 0, end: 1, expectedHash: hashText('wrong'), replacement: '' }, message: /changed/ }
  ])('rejects $name without changing the workspace', ({ change, message }) => {
    const workspace = createWorkspace('abc');
    expect(() => applySourcePatches(workspace, [{ fileId: 'index.html', ...change }])).toThrow(message);
    expect(workspace.files.get('index.html')?.content).toBe('abc');
    expect(workspace.revision).toBe(0);
  });

  it('rejects overlapping patches', () => {
    const workspace = createWorkspace('abcdef');
    expect(() => applySourcePatches(workspace, [
      patch(1, 4, 'abcdef', 'x'),
      patch(3, 5, 'abcdef', 'y')
    ])).toThrow(/overlapping/);
  });

  it('allows adjacent patches and calculates shifted inverse ranges exactly', () => {
    const source = 'abcdefghij';
    const workspace = createWorkspace(source);
    const applied = applySourcePatches(workspace, [
      patch(1, 4, source, 'X'),
      patch(6, 8, source, 'LONG')
    ]);
    expect(applied.workspace.files.get('index.html')?.content).toBe('aXefLONGij');
    expect(applied.inversePatches).toEqual([
      { fileId: 'index.html', start: 1, end: 2, expectedHash: hashText('X'), replacement: 'bcd' },
      { fileId: 'index.html', start: 4, end: 8, expectedHash: hashText('LONG'), replacement: 'gh' }
    ]);
    expect(applySourcePatches(applied.workspace, applied.inversePatches).workspace.files.get('index.html')?.content).toBe(source);

    const adjacent = applySourcePatches(createWorkspace('abcd'), [
      patch(0, 2, 'abcd', 'AB'),
      patch(2, 4, 'abcd', 'CD')
    ]);
    expect(adjacent.workspace.files.get('index.html')?.content).toBe('ABCD');
  });

  it('rejects unknown files and leaves all source files untouched', () => {
    const workspace = createWorkspace('stable');
    expect(() => applySourcePatches(workspace, [patch(0, 0, '', 'x', 'missing.html')]))
      .toThrow(new PatchConflictError('Unknown source file: missing.html'));
    expect(workspace.files.get('index.html')?.content).toBe('stable');
  });

  it('does not partially commit a multi-file transaction when a later file conflicts', () => {
    const first: SourceFile = { id: 'first.html', path: 'first.html', mediaType: 'text/html', content: 'first', contentHash: hashText('first') };
    const second: SourceFile = { id: 'second.html', path: 'second.html', mediaType: 'text/html', content: 'second', contentHash: hashText('second') };
    const workspace: WorkspaceSnapshot = { revision: 4, entryFileId: first.id, files: new Map([[first.id, first], [second.id, second]]) };

    expect(() => applySourcePatches(workspace, [
      patch(0, 5, first.content, 'changed', first.id),
      { fileId: second.id, start: 0, end: 6, expectedHash: hashText('stale'), replacement: 'broken' }
    ])).toThrow(/changed/);
    expect(workspace.files.get(first.id)?.content).toBe('first');
    expect(workspace.files.get(second.id)?.content).toBe('second');
    expect(workspace.revision).toBe(4);
  });
});
