import React, { useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';
import type { PendingHtmlImport } from './use-html-import.js';
import { formatFileSize } from './browser-files.js';

interface HtmlImportDialogProps {
  pendingHtmlImport: PendingHtmlImport;
  isImporting: boolean;
  restoreFocusRef: React.RefObject<HTMLButtonElement | null>;
  onDismiss: () => void;
  onConfirm: () => Promise<void>;
}

export function HtmlImportDialog({ pendingHtmlImport, isImporting, restoreFocusRef, onDismiss, onConfirm }: HtmlImportDialogProps) {
  const htmlImportDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = htmlImportDialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      dialog.close();
      restoreFocusRef.current?.focus();
    };
  }, [pendingHtmlImport, restoreFocusRef]);
  return (
    <dialog
      ref={htmlImportDialogRef}
      className="vhe-import-backdrop"
      aria-labelledby="vhe-import-title"
      aria-describedby="vhe-import-description"
      onCancel={(event) => { event.preventDefault(); if (!isImporting) onDismiss(); }}
      onMouseDown={(event) => { if (event.target === event.currentTarget && !isImporting) onDismiss(); }}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey) {
          if (['z', 'y', 'b', 'd'].includes(event.key.toLowerCase())) event.preventDefault();
          event.stopPropagation();
        }
        if (event.key !== 'Tab') return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const first = buttons[0];
        const last = buttons.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && event.target === last) { event.preventDefault(); first.focus(); }
      }}
    >
      <section className="vhe-import-dialog">
        <div className="vhe-import-dialog__icon" aria-hidden="true"><Upload size={19} strokeWidth={1.8} /></div>
        <div className="vhe-import-dialog__content">
          <span className="vhe-import-dialog__eyebrow">HTML import</span>
          <h2 id="vhe-import-title">{pendingHtmlImport.preview.title}</h2>
          <p id="vhe-import-description">{pendingHtmlImport.preview.description}</p>
          <div className="vhe-import-dialog__file">
            <strong>{pendingHtmlImport.input.file.name}</strong>
            <span>{formatFileSize(pendingHtmlImport.input.file.size)}</span>
          </div>
          {pendingHtmlImport.preview.hasUnsavedChanges && (
            <p className="vhe-import-dialog__warning" role="alert">This replaces your current unsaved work.</p>
          )}
          {Boolean(pendingHtmlImport.preview.warnings?.length) && (
            <ul className="vhe-import-dialog__warnings">
              {pendingHtmlImport.preview.warnings?.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          )}
        </div>
        <div className="vhe-import-dialog__actions">
          <button type="button" className="vhe-button" autoFocus disabled={isImporting} onClick={() => onDismiss()}>Cancel</button>
          <button type="button" className="vhe-button vhe-button--primary" disabled={isImporting} onClick={() => void onConfirm()}>{isImporting ? 'Importing…' : 'Import HTML'}</button>
        </div>
      </section>
    </dialog>
  );
}
