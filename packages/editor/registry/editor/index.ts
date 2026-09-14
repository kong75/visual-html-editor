import './styles.css';

export { resolveElementBehavior } from './element-behavior.js';
export { HtmlEditor } from './html-editor.js';
export { VisualHtmlEditor } from './visual-html-editor.js';
export { useEditorSnapshot } from './use-editor-snapshot.js';
export { useHtmlEditor } from './use-html-editor.js';
export type { ElementBehavior, ElementBehaviorContext, ElementBehaviorResolver, ElementEditTarget } from './element-behavior.js';
export type { HtmlEditorHandle, HtmlEditorProps } from './html-editor.js';
export type { HtmlEditorChange, UseHtmlEditorOptions, UseHtmlEditorResult } from './use-html-editor.js';
export type {
  AssetAdapter,
  EditorSelectionChange,
  EditorTextSelection,
  HtmlImportAdapter,
  HtmlImportInput,
  HtmlImportPreview,
  HtmlImportResult,
  ResolvedAsset,
  VisualHtmlEditorHandle,
  VisualHtmlEditorProps
} from './visual-html-editor.js';
