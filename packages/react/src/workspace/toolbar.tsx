import React from 'react';
import type { AspectRatioOption, EditorProfile } from '@visual-html/core';
import { Code2, Download, Eye, ImagePlus, Redo2, Undo2, Upload } from 'lucide-react';
import type { VisualHtmlEditorProps } from '../editor-types.js';
import { EditorSelect } from '../inspector/controls.js';
import { BrandMark } from '../brand-mark.js';

interface NullableRef<T> {
  current: T | null;
}

interface EditorToolbarProps extends Pick<VisualHtmlEditorProps, 'brandHref' | 'toolbarContent' | 'importAdapter'> {
  documentTitle: string;
  profile: EditorProfile;
  aspect: AspectRatioOption;
  setAspectId: (id: string) => void;
  htmlImportButtonRef: NullableRef<HTMLButtonElement>;
  htmlInputRef: NullableRef<HTMLInputElement>;
  imageInputRef: NullableRef<HTMLInputElement>;
  exportHtml: () => Promise<void>;
  prepareHtmlImport: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleImage: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  mode: 'visual' | 'source';
  canUndo: boolean;
  canRedo: boolean;
  openSource: () => void;
  setMode: (mode: 'visual' | 'source') => void;
  runHistory: (direction: 'undo' | 'redo') => void;
  preserveActiveTextEdit: React.PointerEventHandler<HTMLButtonElement>;
  onImage: () => void;
}

export function EditorToolbar({ brandHref, documentTitle, toolbarContent, profile, aspect, setAspectId, htmlImportButtonRef, htmlInputRef, imageInputRef, exportHtml, importAdapter, prepareHtmlImport, handleImage, mode, canUndo, canRedo, openSource, setMode, runHistory, preserveActiveTextEdit, onImage }: EditorToolbarProps) {
  return (
    <header className="vhe-toolbar">
      {brandHref ? (
        <a className="vhe-brand" href={brandHref} aria-label="Visual HTML home">
          <span className="vhe-brand__mark" aria-hidden="true"><BrandMark /></span>
          <span className="vhe-brand__copy"><small>Visual HTML</small><strong>{documentTitle}</strong></span>
        </a>
      ) : (
        <div className="vhe-brand">
          <span className="vhe-brand__mark" aria-hidden="true"><BrandMark /></span>
          <span className="vhe-brand__copy"><small>Visual HTML</small><strong>{documentTitle}</strong></span>
        </div>
      )}
      {toolbarContent && <div className="vhe-toolbar__content">{toolbarContent}</div>}
      <div className="vhe-viewport-select">
        <EditorSelect
          ariaLabel={`Viewport: ${aspect.label}`}
          menuAriaLabel="Viewport options"
          value={aspect.id}
          options={profile.aspectRatios.map((option) => ({
            value: option.id,
            label: option.label,
            description: `${option.width} × ${option.height}`,
            previewWidth: option.width,
            previewHeight: option.height
          }))}
          triggerClassName="vhe-viewport-select__trigger"
          popupClassName="vhe-select__popup--viewport"
          onValueChange={setAspectId}
          renderTrigger={(selected) => (
            <>
              <span className="vhe-select__ratio" style={{ aspectRatio: `${selected.previewWidth} / ${selected.previewHeight}` }} aria-hidden="true" />
              <span className="vhe-viewport-select__value">{selected.label}</span>
            </>
          )}
        />
      </div>
      <div className="vhe-toolbar__spacer" />
      <div className="vhe-toolbar__editing-tools" role="toolbar" aria-label="Editing tools">
        <div className="vhe-inspector__tool-group">
          {profile.capabilities.insertImages && <button type="button" className="vhe-tool-button" onClick={onImage} aria-label="Image" title="Insert image"><ImagePlus size={15} strokeWidth={1.8} aria-hidden="true" /></button>}
          {profile.capabilities.editSource && (
            <button type="button" className={`vhe-tool-button${mode === 'source' ? ' vhe-tool-button--active' : ''}`} onClick={mode === 'visual' ? openSource : () => setMode('visual')} aria-label={mode === 'visual' ? 'Source' : 'Visual'} title={mode === 'visual' ? 'Edit HTML source' : 'Return to canvas'}>
              {mode === 'visual' ? <Code2 size={14} strokeWidth={1.8} aria-hidden="true" /> : <Eye size={14} strokeWidth={1.8} aria-hidden="true" />}
            </button>
          )}
        </div>
        <div className="vhe-inspector__tool-group vhe-inspector__tool-group--history">
          <button type="button" className="vhe-tool-button" disabled={!canUndo} onPointerDown={preserveActiveTextEdit} onClick={() => runHistory('undo')} aria-label="Undo" title="Undo · Ctrl/Cmd+Z"><Undo2 size={15} strokeWidth={1.8} aria-hidden="true" /></button>
          <button type="button" className="vhe-tool-button" disabled={!canRedo} onPointerDown={preserveActiveTextEdit} onClick={() => runHistory('redo')} aria-label="Redo" title="Redo · Ctrl/Cmd+Shift+Z"><Redo2 size={15} strokeWidth={1.8} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="vhe-toolbar__actions">
        {profile.capabilities.importHtml && (
          <button ref={htmlImportButtonRef} type="button" className="vhe-button vhe-toolbar__action vhe-toolbar__action--import" aria-label="Import HTML" title="Import HTML" onClick={() => htmlInputRef.current?.click()}><Upload size={15} strokeWidth={1.8} aria-hidden="true" /><span>Import HTML</span></button>
        )}
        <button type="button" className="vhe-button vhe-button--primary vhe-toolbar__action vhe-toolbar__action--export" aria-label="Export HTML" title="Export HTML" onClick={exportHtml}><Download size={15} strokeWidth={1.8} aria-hidden="true" /><span>Export HTML</span></button>
      </div>
      <input ref={htmlInputRef} className="vhe-hidden" type="file" accept={importAdapter?.accept ?? '.html,.htm,text/html,application/xhtml+xml'} aria-label="Import HTML file" onChange={prepareHtmlImport} />
      <input ref={imageInputRef} className="vhe-hidden" type="file" accept="image/*" aria-label="Choose image file" onChange={handleImage} />
    </header>
  );
}
