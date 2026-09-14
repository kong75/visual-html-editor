import MagicString from 'magic-string';
import { hashText } from './hash.js';
import type { SourceFile, SourcePatch, WorkspaceSnapshot } from './types.js';

export class PatchConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatchConflictError';
  }
}

export function createWorkspace(html: string): WorkspaceSnapshot {
  const file: SourceFile = {
    id: 'index.html',
    path: 'index.html',
    mediaType: 'text/html',
    content: html,
    contentHash: hashText(html)
  };
  return {
    revision: 0,
    entryFileId: file.id,
    files: new Map([[file.id, file]])
  };
}

function validatePatches(source: string, patches: readonly SourcePatch[]): void {
  const sorted = [...patches].sort((left, right) => left.start - right.start);
  let previousEnd = -1;
  for (const patch of sorted) {
    if (patch.start < 0 || patch.end < patch.start || patch.end > source.length) {
      throw new PatchConflictError('Patch range is outside the source file.');
    }
    if (patch.start < previousEnd) {
      throw new PatchConflictError('A transaction contains overlapping source patches.');
    }
    const actualHash = hashText(source.slice(patch.start, patch.end));
    if (actualHash !== patch.expectedHash) {
      throw new PatchConflictError('Source changed before the transaction could be applied.');
    }
    previousEnd = patch.end;
  }
}

export function applySourcePatches(
  workspace: WorkspaceSnapshot,
  patches: readonly SourcePatch[]
): { workspace: WorkspaceSnapshot; inversePatches: SourcePatch[] } {
  const grouped = new Map<string, SourcePatch[]>();
  for (const patch of patches) {
    const group = grouped.get(patch.fileId) ?? [];
    group.push(patch);
    grouped.set(patch.fileId, group);
  }

  const nextFiles = new Map(workspace.files);
  const inversePatches: SourcePatch[] = [];

  for (const [fileId, filePatches] of grouped) {
    const file = workspace.files.get(fileId);
    if (!file) throw new PatchConflictError(`Unknown source file: ${fileId}`);
    validatePatches(file.content, filePatches);

    const sorted = [...filePatches].sort((left, right) => left.start - right.start);
    let delta = 0;
    for (const patch of sorted) {
      const original = file.content.slice(patch.start, patch.end);
      const resultStart = patch.start + delta;
      inversePatches.push({
        fileId,
        start: resultStart,
        end: resultStart + patch.replacement.length,
        expectedHash: hashText(patch.replacement),
        replacement: original
      });
      delta += patch.replacement.length - (patch.end - patch.start);
    }

    const magic = new MagicString(file.content);
    for (const patch of filePatches) {
      if (patch.start === patch.end) magic.appendLeft(patch.start, patch.replacement);
      else magic.overwrite(patch.start, patch.end, patch.replacement);
    }
    const content = magic.toString();
    nextFiles.set(fileId, {
      ...file,
      content,
      contentHash: hashText(content)
    });
  }

  return {
    workspace: {
      ...workspace,
      revision: workspace.revision + 1,
      files: nextFiles
    },
    inversePatches
  };
}
