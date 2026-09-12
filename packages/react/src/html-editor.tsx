import React from 'react';
import type {
  EditorController,
  EditorProfile,
  ExternalSourceUpdatePolicy,
  SourceReplacementResult,
  ValidationIssue
} from '@visual-html/core';
import { useHtmlEditor, type HtmlEditorChange } from './use-html-editor.js';
import { VisualHtmlEditor, type VisualHtmlEditorProps } from './visual-html-editor.js';

export interface HtmlEditorProps extends Omit<VisualHtmlEditorProps, 'controller'> {
  value: string;
  profile: EditorProfile;
  externalUpdate?: ExternalSourceUpdatePolicy;
  onChange?: (change: HtmlEditorChange) => void;
  onValidationChange?: (issues: readonly ValidationIssue[]) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onReady?: (controller: EditorController) => void;
  onExternalUpdateResult?: (result: SourceReplacementResult) => void;
  onError?: (error: Error) => void;
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode | ((error: Error) => React.ReactNode);
}

export function HtmlEditor({
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
}: HtmlEditorProps): React.JSX.Element {
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

  if (session.status === 'error' && session.error) {
    if (typeof errorFallback === 'function') return <>{errorFallback(session.error)}</>;
    return <>{errorFallback ?? <div className="vhe-controlled-state" role="alert">Unable to open this HTML document.</div>}</>;
  }
  if (!session.controller) {
    return <>{loadingFallback ?? <div className="vhe-controlled-state" role="status">Preparing HTML editor…</div>}</>;
  }

  return <VisualHtmlEditor {...editorProps} controller={session.controller} />;
}
