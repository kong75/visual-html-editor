import { useEffect, useRef, useState } from 'react';
import {
  EditorController,
  type EditorProfile,
  type ExternalSourceUpdatePolicy,
  type SourceReplacementResult,
  type TransactionCommittedEvent,
  type ValidationIssue
} from '@visual-html/core';

export interface HtmlEditorChange {
  html: string;
  revision: number;
  transaction: TransactionCommittedEvent;
}

export interface UseHtmlEditorOptions {
  value: string;
  profile: EditorProfile;
  externalUpdate?: ExternalSourceUpdatePolicy;
  onChange?: (change: HtmlEditorChange) => void;
  onValidationChange?: (issues: readonly ValidationIssue[]) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onReady?: (controller: EditorController) => void;
  onExternalUpdateResult?: (result: SourceReplacementResult) => void;
  onError?: (error: Error) => void;
}

export interface UseHtmlEditorResult {
  controller: EditorController | null;
  status: 'loading' | 'ready' | 'error';
  error: Error | null;
}

interface CallbackSet {
  onChange?: UseHtmlEditorOptions['onChange'];
  onValidationChange?: UseHtmlEditorOptions['onValidationChange'];
  onDirtyChange?: UseHtmlEditorOptions['onDirtyChange'];
  onReady?: UseHtmlEditorOptions['onReady'];
  onExternalUpdateResult?: UseHtmlEditorOptions['onExternalUpdateResult'];
  onError?: UseHtmlEditorOptions['onError'];
}

export function useHtmlEditor({
  value,
  profile,
  externalUpdate = 'replace-when-clean',
  onChange,
  onValidationChange,
  onDirtyChange,
  onReady,
  onExternalUpdateResult,
  onError
}: UseHtmlEditorOptions): UseHtmlEditorResult {
  const [controller, setController] = useState<EditorController | null>(null);
  const [status, setStatus] = useState<UseHtmlEditorResult['status']>('loading');
  const [error, setError] = useState<Error | null>(null);
  const initialValueRef = useRef(value);
  const initialProfileRef = useRef(profile);
  const externalUpdateVersionRef = useRef(0);
  const callbacksRef = useRef<CallbackSet>({});
  callbacksRef.current = {
    onChange,
    onValidationChange,
    onDirtyChange,
    onReady,
    onExternalUpdateResult,
    onError
  };

  useEffect(() => {
    let active = true;
    const unsubscribers: Array<() => void> = [];

    EditorController.create({
      html: initialValueRef.current,
      profile: initialProfileRef.current
    }).then((createdController) => {
      if (!active) return;

      unsubscribers.push(
        createdController.on('transactionCommitted', (transaction) => {
          if (transaction.kind === 'source-replacement' && !transaction.command) return;
          const snapshot = createdController.getSnapshot();
          callbacksRef.current.onChange?.({
            html: snapshot.html,
            revision: snapshot.revision,
            transaction
          });
        }),
        createdController.on('validationChanged', (event) => {
          callbacksRef.current.onValidationChange?.(event.issues);
        }),
        createdController.on('dirtyChanged', (event) => {
          callbacksRef.current.onDirtyChange?.(event.dirty);
        }),
        createdController.on('fatalError', (event) => {
          callbacksRef.current.onError?.(event.error);
        })
      );

      const snapshot = createdController.getSnapshot();
      setController(createdController);
      setStatus('ready');
      setError(null);
      callbacksRef.current.onValidationChange?.(snapshot.issues);
      callbacksRef.current.onDirtyChange?.(snapshot.dirty);
      callbacksRef.current.onReady?.(createdController);
    }).catch((reason: unknown) => {
      if (!active) return;
      const nextError = reason instanceof Error ? reason : new Error('Unable to create the HTML editor.');
      setError(nextError);
      setStatus('error');
      callbacksRef.current.onError?.(nextError);
    });

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  useEffect(() => {
    if (!controller || controller.getSnapshot().profile === profile) return;
    controller.setProfile(profile);
  }, [controller, profile]);

  useEffect(() => {
    if (!controller || controller.getSnapshot().html === value) return;
    externalUpdateVersionRef.current += 1;
    const updateVersion = externalUpdateVersionRef.current;

    controller.replaceSource(value, { policy: externalUpdate }).then((result) => {
      if (updateVersion !== externalUpdateVersionRef.current) return;
      callbacksRef.current.onExternalUpdateResult?.(result);
    }).catch((reason: unknown) => {
      if (updateVersion !== externalUpdateVersionRef.current) return;
      const nextError = reason instanceof Error ? reason : new Error('Unable to apply external HTML.');
      callbacksRef.current.onError?.(nextError);
    });
  }, [controller, externalUpdate, value]);

  return { controller, status, error };
}
