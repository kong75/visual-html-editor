import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import type {
  EditorController,
  EditorProfile,
  ExternalSourceUpdatePolicy,
  SourceReplacementResult,
  ValidationIssue
} from '@visual-html/core';
import { useHtmlEditor, type HtmlEditorChange } from './use-html-editor.js';
import { VisualHtmlEditor, type VisualHtmlEditorHandle, type VisualHtmlEditorProps } from './visual-html-editor.js';

export interface HtmlEditorProps extends Omit<VisualHtmlEditorProps, 'controller'> {
  value: string;
  profile: EditorProfile;
  externalUpdate?: ExternalSourceUpdatePolicy;
  onChange?: (change: HtmlEditorChange) => void | Promise<void>;
  onValidationChange?: (issues: readonly ValidationIssue[]) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onReady?: (controller: EditorController) => void;
  onExternalUpdateResult?: (result: SourceReplacementResult) => void;
  onError?: (error: Error) => void;
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode | ((error: Error) => React.ReactNode);
}

export type HtmlEditorHandle = VisualHtmlEditorHandle;

export const HtmlEditor = forwardRef<HtmlEditorHandle, HtmlEditorProps>(function HtmlEditor({
  value,
  profile,
  externalUpdate,
  onChange,
  onValidationChange,
  onDirtyChange,
  onReady,
  onExternalUpdateResult,
  onError,
  loadingFallback,
  errorFallback,
  ...editorProps
}: HtmlEditorProps, ref): React.JSX.Element {
  const editorRef = useRef<VisualHtmlEditorHandle>(null);
  const session = useHtmlEditor({
    value,
    profile,
    externalUpdate,
    onChange,
    onValidationChange,
    onDirtyChange,
    onReady,
    onExternalUpdateResult,
    onError
  });

  useImperativeHandle(ref, () => ({
    async flush() {
      if (!editorRef.current) throw new Error('The HTML editor is not ready.');
      const result = await editorRef.current.flush();
      await session.flushChanges();
      return result;
    },
    openImportPicker() {
      editorRef.current?.openImportPicker();
    },
    getTextSelection() {
      return editorRef.current?.getTextSelection() ?? null;
    },
    async toggleSelectedTextMark(mark, selection) {
      if (!editorRef.current) throw new Error('The HTML editor is not ready.');
      return editorRef.current.toggleSelectedTextMark(mark, selection);
    },
    async setSelectedTextStyles(styles, selection) {
      if (!editorRef.current) throw new Error('The HTML editor is not ready.');
      return editorRef.current.setSelectedTextStyles(styles, selection);
    }
  }), [session.flushChanges]);

  if (session.status === 'error' && session.error) {
    if (typeof errorFallback === 'function') return <>{errorFallback(session.error)}</>;
    return <>{errorFallback ?? <div className="vhe-controlled-state" role="alert">Unable to open this HTML document.</div>}</>;
  }
  if (!session.controller) {
    return <>{loadingFallback ?? <div className="vhe-controlled-state" role="status">Preparing HTML editor…</div>}</>;
  }

  return <VisualHtmlEditor ref={editorRef} {...editorProps} controller={session.controller} />;
});
