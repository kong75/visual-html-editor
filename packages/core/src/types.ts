export type FileId = string;
export type NodeKey = string;

export interface SourceRange {
  start: number;
  end: number;
}

export interface TextRange {
  start: number;
  end: number;
}

export type InlineMark = 'strong' | 'em' | 'u' | 's';

export interface SourceFile {
  id: FileId;
  path: string;
  mediaType: string;
  content: string;
  contentHash: string;
}

export interface WorkspaceSnapshot {
  revision: number;
  entryFileId: FileId;
  files: ReadonlyMap<FileId, SourceFile>;
}

export interface AspectRatioOption {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface HtmlPolicy {
  allowedTags: readonly string[];
  allowedAttributes: readonly string[];
  allowedCssProperties: readonly string[];
  allowedProtocols: readonly string[];
  allowDataAttributes: boolean;
  allowAriaAttributes: boolean;
}

export interface EditorCapabilities {
  editText: boolean;
  editStyles: boolean;
  insertImages: boolean;
  replaceImages: boolean;
  dragElements: boolean;
  resizeElements: boolean;
  duplicateElements: boolean;
  deleteElements: boolean;
  importHtml: boolean;
  editSource: boolean;
}

export interface EditorProfile {
  id: 'email' | 'slides' | 'web' | string;
  label: string;
  description: string;
  html: HtmlPolicy;
  capabilities: EditorCapabilities;
  aspectRatios: readonly AspectRatioOption[];
  defaultAspectRatioId: string;
  fidelity: 'preserve' | 'balanced' | 'normalize';
}

export interface EditorProfileOverrides {
  id?: string;
  label?: string;
  description?: string;
  html?: Partial<HtmlPolicy>;
  capabilities?: Partial<EditorCapabilities>;
  aspectRatios?: readonly AspectRatioOption[];
  defaultAspectRatioId?: string;
  fidelity?: EditorProfile['fidelity'];
}

export interface ParsedAttribute {
  name: string;
  value: string;
  range?: SourceRange;
}

export interface ParsedNode {
  key: NodeKey;
  revision: number;
  fileId: FileId;
  tagName: string;
  range?: SourceRange;
  startTagRange?: SourceRange;
  endTagRange?: SourceRange;
  innerRange?: SourceRange;
  attributes: ReadonlyMap<string, ParsedAttribute>;
  parentKey?: NodeKey;
  childKeys: readonly NodeKey[];
  hasElementChildren: boolean;
  textContent: string;
  virtual: boolean;
}

export interface DocumentIndex {
  revision: number;
  isFragment: boolean;
  nodes: ReadonlyMap<NodeKey, ParsedNode>;
  rootKeys: readonly NodeKey[];
}

export interface SourcePatch {
  fileId: FileId;
  start: number;
  end: number;
  expectedHash: string;
  replacement: string;
}

export type EditorCommand =
  | { type: 'setText'; nodeKey: NodeKey; text: string }
  | { type: 'setRichText'; nodeKey: NodeKey; html: string }
  | { type: 'toggleInlineMark'; nodeKey: NodeKey; range: TextRange; mark: InlineMark }
  | { type: 'setAttribute'; nodeKey: NodeKey; name: string; value: string | null }
  | { type: 'setStyle'; nodeKey: NodeKey; property: string; value: string | null }
  | { type: 'setStyles'; nodeKey: NodeKey; styles: Readonly<Record<string, string | null>> }
  | { type: 'removeNode'; nodeKey: NodeKey }
  | { type: 'duplicateNode'; nodeKey: NodeKey }
  | { type: 'insertImage'; targetNodeKey?: NodeKey; src: string; alt: string }
  | { type: 'replaceImage'; nodeKey: NodeKey; src: string | null; alt?: string }
  | { type: 'applySource'; source: string };

export interface ValidationIssue {
  code: string;
  severity: 'info' | 'warning' | 'error' | 'blocking';
  message: string;
  fileId?: FileId;
  nodeKey?: NodeKey;
  range?: SourceRange;
}

export interface RuntimeProjection {
  revision: number;
  html: string;
  runtimeAttribute: string;
}

export interface EditorSnapshot {
  revision: number;
  html: string;
  profile: EditorProfile;
  nodes: readonly ParsedNode[];
  issues: readonly ValidationIssue[];
  projection: RuntimeProjection;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
}

export interface CommandSuccess {
  ok: true;
  revision: number;
  description: string;
}

export interface CommandFailure {
  ok: false;
  code: string;
  message: string;
}

export type CommandResult = CommandSuccess | CommandFailure;

export type ExternalSourceUpdatePolicy = 'replace' | 'replace-when-clean' | 'reject-when-dirty';

export interface ReplaceSourceOptions {
  policy?: ExternalSourceUpdatePolicy;
  createCheckpoint?: boolean;
  recordHistory?: boolean;
  description?: string;
}

export interface SourceReplacementSuccess extends CommandSuccess {
  replaced: boolean;
  reason?: 'unchanged' | 'dirty';
}

export type SourceReplacementResult = SourceReplacementSuccess | CommandFailure;

export type EditorTransactionKind = 'command' | 'undo' | 'redo' | 'source-replacement';

export interface EditorEventBase {
  controllerId: string;
  revision: number;
}

export interface TransactionCommittedEvent extends EditorEventBase {
  type: 'transactionCommitted';
  kind: EditorTransactionKind;
  previousRevision: number;
  description: string;
  command?: EditorCommand;
  patches: readonly SourcePatch[];
}

export interface TransactionRejectedEvent extends EditorEventBase {
  type: 'transactionRejected';
  kind: 'command' | 'source-replacement';
  command?: EditorCommand;
  result: CommandFailure;
}

export interface RevisionChangedEvent extends EditorEventBase {
  type: 'revisionChanged';
  previousRevision: number;
  kind: EditorTransactionKind;
  description: string;
}

export interface ValidationChangedEvent extends EditorEventBase {
  type: 'validationChanged';
  issues: readonly ValidationIssue[];
}

export interface DirtyChangedEvent extends EditorEventBase {
  type: 'dirtyChanged';
  dirty: boolean;
}

export interface ProfileChangedEvent extends EditorEventBase {
  type: 'profileChanged';
  profile: EditorProfile;
  previousProfile: EditorProfile;
}

export interface FatalErrorEvent extends EditorEventBase {
  type: 'fatalError';
  error: Error;
}

export interface EditorEventMap {
  transactionCommitted: TransactionCommittedEvent;
  transactionRejected: TransactionRejectedEvent;
  revisionChanged: RevisionChangedEvent;
  validationChanged: ValidationChangedEvent;
  dirtyChanged: DirtyChangedEvent;
  profileChanged: ProfileChangedEvent;
  fatalError: FatalErrorEvent;
}

export type EditorEventType = keyof EditorEventMap;
export type EditorEvent = EditorEventMap[EditorEventType];

export interface ExportResult {
  revision: number;
  html: string;
  issues: readonly ValidationIssue[];
}
