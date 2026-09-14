import { parseHtmlSource } from './parser.js';
import { applySourcePatches, createWorkspace, PatchConflictError } from './patcher.js';
import { planCommand } from './planner.js';
import { buildRuntimeProjection } from './projection.js';
import { validateWorkspace } from './validation.js';
import type {
  CommandFailure,
  CommandResult,
  DocumentIndex,
  EditorCommand,
  EditorEventMap,
  EditorEventType,
  EditorProfile,
  EditorSnapshot,
  EditorTransactionKind,
  ExportResult,
  ParsedNode,
  ReplaceSourceOptions,
  SourcePatch,
  SourceReplacementResult,
  ValidationIssue,
  WorkspaceSnapshot
} from './types.js';

interface HistoryEntry {
  description: string;
  forwardPatches: SourcePatch[];
  inversePatches: SourcePatch[];
}

interface ObservableState {
  revision: number;
  dirty: boolean;
  issues: readonly ValidationIssue[];
}

interface AppliedPatches {
  result: CommandResult;
  inversePatches?: SourcePatch[];
}

export interface CreateEditorControllerOptions {
  html: string;
  profile: EditorProfile;
}

let controllerCounter = 0;

function issuesSignature(issues: readonly ValidationIssue[]): string {
  return JSON.stringify(issues.map((issue) => ({
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    fileId: issue.fileId,
    nodeKey: issue.nodeKey,
    range: issue.range
  })));
}

export class EditorController {
  readonly id: string;

  private workspace: WorkspaceSnapshot;
  private index: DocumentIndex;
  private profile: EditorProfile;
  private history: HistoryEntry[] = [];
  private historyCursor = -1;
  private checkpoint: WorkspaceSnapshot;
  private keyCounter = 0;
  private listeners = new Set<() => void>();
  private eventListeners = new Map<EditorEventType, Set<(event: unknown) => void>>();

  private constructor(options: CreateEditorControllerOptions) {
    controllerCounter += 1;
    this.id = `vhe-editor-${controllerCounter.toString(36)}`;
    this.workspace = createWorkspace(options.html);
    this.checkpoint = this.workspace;
    this.profile = options.profile;
    this.index = this.parse();
  }

  static async create(options: CreateEditorControllerOptions): Promise<EditorController> {
    return new EditorController(options);
  }

  private allocateKey = (): string => {
    this.keyCounter += 1;
    return `vhe-${this.keyCounter.toString(36)}`;
  };

  private parse(previousIndex?: DocumentIndex, patches?: readonly SourcePatch[]): DocumentIndex {
    return this.parseWorkspace(this.workspace, previousIndex, patches);
  }

  private parseWorkspace(
    workspace: WorkspaceSnapshot,
    previousIndex?: DocumentIndex,
    patches?: readonly SourcePatch[]
  ): DocumentIndex {
    const file = workspace.files.get(workspace.entryFileId);
    if (!file) throw new Error('Entry HTML file is missing.');
    return parseHtmlSource(file.content, {
      revision: workspace.revision,
      fileId: file.id,
      previousIndex,
      patches,
      allocateKey: this.allocateKey
    });
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private emitEvent<K extends EditorEventType>(type: K, event: EditorEventMap[K]): void {
    for (const listener of this.eventListeners.get(type) ?? []) listener(event);
  }

  private captureState(): ObservableState {
    return {
      revision: this.workspace.revision,
      dirty: this.isDirty(),
      issues: validateWorkspace(this.workspace, this.index, this.profile)
    };
  }

  private isDirty(): boolean {
    if (this.workspace.entryFileId !== this.checkpoint.entryFileId || this.workspace.files.size !== this.checkpoint.files.size) return true;
    for (const [id, file] of this.workspace.files) {
      const saved = this.checkpoint.files.get(id);
      if (!saved || file.contentHash !== saved.contentHash || file.content !== saved.content) return true;
    }
    return false;
  }

  private publishObservableChanges(before: ObservableState, after: ObservableState): void {
    if (issuesSignature(before.issues) !== issuesSignature(after.issues)) {
      this.emitEvent('validationChanged', {
        type: 'validationChanged',
        controllerId: this.id,
        revision: after.revision,
        issues: after.issues
      });
    }
    if (before.dirty !== after.dirty) {
      this.emitEvent('dirtyChanged', {
        type: 'dirtyChanged',
        controllerId: this.id,
        revision: after.revision,
        dirty: after.dirty
      });
    }
  }

  private publishTransaction(
    before: ObservableState,
    kind: EditorTransactionKind,
    description: string,
    patches: readonly SourcePatch[],
    command?: EditorCommand
  ): void {
    const after = this.captureState();
    this.emit();
    this.emitEvent('transactionCommitted', {
      type: 'transactionCommitted',
      controllerId: this.id,
      revision: after.revision,
      previousRevision: before.revision,
      kind,
      description,
      command,
      patches
    });
    if (before.revision !== after.revision) {
      this.emitEvent('revisionChanged', {
        type: 'revisionChanged',
        controllerId: this.id,
        revision: after.revision,
        previousRevision: before.revision,
        kind,
        description
      });
    }
    this.publishObservableChanges(before, after);
  }

  private rejectTransaction(
    kind: 'command' | 'source-replacement',
    result: CommandFailure,
    command?: EditorCommand
  ): CommandFailure {
    this.emitEvent('transactionRejected', {
      type: 'transactionRejected',
      controllerId: this.id,
      revision: this.workspace.revision,
      kind,
      command,
      result
    });
    return result;
  }

  private applyPatches(patches: SourcePatch[], description: string): AppliedPatches {
    const previousIndex = this.index;
    try {
      const applied = applySourcePatches(this.workspace, patches);
      const nextIndex = this.parseWorkspace(applied.workspace, previousIndex, patches);
      this.workspace = applied.workspace;
      this.index = nextIndex;
      return {
        result: { ok: true, revision: this.workspace.revision, description },
        inversePatches: applied.inversePatches
      };
    } catch (error) {
      if (error instanceof PatchConflictError) {
        return { result: { ok: false, code: 'patch-conflict', message: error.message } };
      }
      const fatalError = error instanceof Error ? error : new Error('The transaction failed.');
      this.emitEvent('fatalError', {
        type: 'fatalError',
        controllerId: this.id,
        revision: this.workspace.revision,
        error: fatalError
      });
      return {
        result: {
          ok: false,
          code: 'transaction-failed',
          message: fatalError.message
        }
      };
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  on<K extends EditorEventType>(type: K, listener: (event: EditorEventMap[K]) => void): () => void {
    const listeners = this.eventListeners.get(type) ?? new Set<(event: unknown) => void>();
    listeners.add(listener as (event: unknown) => void);
    this.eventListeners.set(type, listeners);
    return () => {
      listeners.delete(listener as (event: unknown) => void);
      if (listeners.size === 0) this.eventListeners.delete(type);
    };
  }

  getSnapshot(): EditorSnapshot {
    const file = this.workspace.files.get(this.workspace.entryFileId);
    if (!file) throw new Error('Entry HTML file is missing.');
    const issues = validateWorkspace(this.workspace, this.index, this.profile);
    return {
      revision: this.workspace.revision,
      html: file.content,
      profile: this.profile,
      nodes: [...this.index.nodes.values()],
      issues,
      projection: buildRuntimeProjection(file.content, this.index),
      canUndo: this.historyCursor >= 0,
      canRedo: this.historyCursor < this.history.length - 1,
      dirty: this.isDirty()
    };
  }

  getNode(key: string): ParsedNode | undefined {
    return this.index.nodes.get(key);
  }

  setProfile(profile: EditorProfile): void {
    if (profile === this.profile) return;
    const before = this.captureState();
    const previousProfile = this.profile;
    this.profile = profile;
    const after = this.captureState();
    this.emit();
    this.emitEvent('profileChanged', {
      type: 'profileChanged',
      controllerId: this.id,
      revision: after.revision,
      profile,
      previousProfile
    });
    this.publishObservableChanges(before, after);
  }

  createCheckpoint(): void {
    const before = this.captureState();
    this.checkpoint = this.workspace;
    const after = this.captureState();
    if (before.dirty === after.dirty) return;
    this.emit();
    this.publishObservableChanges(before, after);
  }

  async dispatch(command: EditorCommand, baseRevision = this.workspace.revision): Promise<CommandResult> {
    if (baseRevision !== this.workspace.revision) {
      return this.rejectTransaction('command', {
        ok: false,
        code: 'revision-conflict',
        message: `Command targeted revision ${baseRevision}, but the current revision is ${this.workspace.revision}.`
      }, command);
    }
    const planned = planCommand(command, this.workspace, this.index, this.profile);
    if ('ok' in planned) return this.rejectTransaction('command', planned, command);

    const before = this.captureState();
    const applied = this.applyPatches(planned.patches, planned.description);
    if (!applied.result.ok || !applied.inversePatches) {
      return this.rejectTransaction('command', applied.result as CommandFailure, command);
    }

    this.history = this.history.slice(0, this.historyCursor + 1);
    this.history.push({
      description: planned.description,
      forwardPatches: planned.patches,
      inversePatches: applied.inversePatches
    });
    this.historyCursor = this.history.length - 1;
    this.publishTransaction(before, 'command', planned.description, planned.patches, command);
    return applied.result;
  }

  async undo(): Promise<CommandResult> {
    if (this.historyCursor < 0) return { ok: false, code: 'nothing-to-undo', message: 'Nothing to undo.' };
    const entry = this.history[this.historyCursor];
    const before = this.captureState();
    const applied = this.applyPatches(entry.inversePatches, `Undo: ${entry.description}`);
    if (!applied.result.ok) return applied.result;
    this.historyCursor -= 1;
    this.publishTransaction(before, 'undo', applied.result.description, entry.inversePatches);
    return applied.result;
  }

  async redo(): Promise<CommandResult> {
    if (this.historyCursor >= this.history.length - 1) {
      return { ok: false, code: 'nothing-to-redo', message: 'Nothing to redo.' };
    }
    const entry = this.history[this.historyCursor + 1];
    const before = this.captureState();
    const applied = this.applyPatches(entry.forwardPatches, `Redo: ${entry.description}`);
    if (!applied.result.ok) return applied.result;
    this.historyCursor += 1;
    this.publishTransaction(before, 'redo', applied.result.description, entry.forwardPatches);
    return applied.result;
  }

  async replaceSource(html: string, options: ReplaceSourceOptions = {}): Promise<SourceReplacementResult> {
    const policy = options.policy ?? 'replace';
    const currentFile = this.workspace.files.get(this.workspace.entryFileId);
    if (!currentFile) {
      return this.rejectTransaction('source-replacement', {
        ok: false,
        code: 'entry-file-missing',
        message: 'The entry HTML file is missing.'
      });
    }
    if (currentFile.content === html) {
      return {
        ok: true,
        revision: this.workspace.revision,
        description: 'HTML source is already current',
        replaced: false,
        reason: 'unchanged'
      };
    }

    const dirty = this.isDirty();
    if (dirty && policy === 'replace-when-clean') {
      return {
        ok: true,
        revision: this.workspace.revision,
        description: 'External HTML was ignored because the editor has unsaved changes',
        replaced: false,
        reason: 'dirty'
      };
    }
    if (dirty && policy === 'reject-when-dirty') {
      return this.rejectTransaction('source-replacement', {
        ok: false,
        code: 'dirty-source-replacement',
        message: 'External HTML cannot replace a document with unsaved changes.'
      });
    }

    const before = this.captureState();
    const patch: SourcePatch = {
      fileId: currentFile.id,
      start: 0,
      end: currentFile.content.length,
      expectedHash: currentFile.contentHash,
      replacement: html
    };

    try {
      if (options.recordHistory) {
        const description = options.description ?? 'Replace HTML source';
        const applied = this.applyPatches([patch], description);
        if (!applied.result.ok || !applied.inversePatches) {
          return this.rejectTransaction('source-replacement', applied.result as CommandFailure);
        }
        this.history = this.history.slice(0, this.historyCursor + 1);
        this.history.push({
          description,
          forwardPatches: [patch],
          inversePatches: applied.inversePatches
        });
        this.historyCursor = this.history.length - 1;
        if (options.createCheckpoint) this.checkpoint = this.workspace;
        this.publishTransaction(before, 'source-replacement', description, [patch], { type: 'applySource', source: html });
        return {
          ok: true,
          revision: this.workspace.revision,
          description,
          replaced: true
        };
      }

      const revision = this.workspace.revision + 1;
      const nextWorkspace = { ...createWorkspace(html), revision };
      const nextIndex = this.parseWorkspace(nextWorkspace);
      this.workspace = nextWorkspace;
      this.index = nextIndex;
      this.history = [];
      this.historyCursor = -1;
      if (options.createCheckpoint ?? true) this.checkpoint = this.workspace;
      const description = options.description ?? 'Replace HTML source';
      this.publishTransaction(before, 'source-replacement', description, [patch]);
      return {
        ok: true,
        revision,
        description,
        replaced: true
      };
    } catch (error) {
      const fatalError = error instanceof Error ? error : new Error('Unable to replace HTML source.');
      this.emitEvent('fatalError', {
        type: 'fatalError',
        controllerId: this.id,
        revision: this.workspace.revision,
        error: fatalError
      });
      return this.rejectTransaction('source-replacement', {
        ok: false,
        code: 'source-replacement-failed',
        message: fatalError.message
      });
    }
  }

  async export(): Promise<ExportResult> {
    const snapshot = this.getSnapshot();
    return {
      revision: snapshot.revision,
      html: snapshot.html,
      issues: snapshot.issues
    };
  }
}
