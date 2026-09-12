export { EditorController } from './controller.js';
export type { CreateEditorControllerOptions } from './controller.js';
export { defineEditorProfile, editorProfiles, emailProfile, extendEditorProfile, slidesProfile, webProfile } from './profiles.js';
export { RUNTIME_NODE_ATTRIBUTE } from './projection.js';
export { hardenRuntimeHtml, RUNTIME_CONTENT_SECURITY_POLICY } from './runtime-security.js';
export { RichTextRangeError, toggleInlineMarkInHtml } from './rich-text.js';
export type { InlineMarkTransform } from './rich-text.js';
export type {
  AspectRatioOption,
  CommandFailure,
  CommandResult,
  CommandSuccess,
  DocumentIndex,
  EditorCapabilities,
  EditorCommand,
  EditorEvent,
  EditorEventBase,
  EditorEventMap,
  EditorEventType,
  EditorProfile,
  EditorProfileOverrides,
  EditorSnapshot,
  EditorTransactionKind,
  ExternalSourceUpdatePolicy,
  ExportResult,
  FatalErrorEvent,
  FileId,
  HtmlPolicy,
  InlineMark,
  NodeKey,
  ParsedAttribute,
  ParsedNode,
  RuntimeProjection,
  ReplaceSourceOptions,
  RevisionChangedEvent,
  SourceFile,
  SourcePatch,
  SourceReplacementResult,
  SourceReplacementSuccess,
  SourceRange,
  TextRange,
  TransactionCommittedEvent,
  TransactionRejectedEvent,
  DirtyChangedEvent,
  ProfileChangedEvent,
  ValidationChangedEvent,
  ValidationIssue,
  WorkspaceSnapshot
} from './types.js';
