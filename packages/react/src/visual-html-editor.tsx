import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { VisualHtmlEditorHandle, VisualHtmlEditorProps } from './editor-types.js';
import type { ElementBehaviorResolver } from './element-behavior.js';
import { useEditorSnapshot } from './use-editor-snapshot.js';
import { useCanvasSelection } from './canvas/use-selection.js';
import { useEditorOutline } from './outline/use-outline.js';
import { useTextEditing } from './canvas/use-text-editing.js';
import { useInspectorProperties } from './inspector/use-properties.js';
import { useCanvasLayout } from './canvas/use-layout.js';
import { useCanvasRuntime } from './canvas/use-runtime.js';
import { useEditorShortcuts } from './workspace/use-shortcuts.js';
import { useEditorFiles } from './workspace/use-files.js';
import { useHtmlImport } from './import/use-html-import.js';
import { HtmlImportDialog } from './import/html-import-dialog.js';
import { EditorToolbar } from './workspace/toolbar.js';
import { EditorStage } from './workspace/stage.js';
import { EditorSidebar } from './workspace/sidebar.js';

export type {
  ResolvedAsset, AssetAdapter, EditorSelectionChange, EditorTextSelection, HtmlImportInput,
  HtmlImportPreview, HtmlImportResult, HtmlImportAdapter, VisualHtmlEditorHandle, VisualHtmlEditorProps
} from './editor-types.js';

interface TransientStatus {
  id: number;
  message: string;
}

const defaultElementBehaviorResolvers: readonly ElementBehaviorResolver[] = [];

export const VisualHtmlEditor = forwardRef<VisualHtmlEditorHandle, VisualHtmlEditorProps>(function VisualHtmlEditor({
  controller,
  assetAdapter,
  className = '',
  brandHref,
  documentTitle = 'Untitled HTML',
  toolbarContent,
  navigationRail,
  workspaceDirty = false,
  sidebarHeader,
  importAdapter,
  baseUrl,
  readOnly = false,
  elementBehaviorResolvers = defaultElementBehaviorResolvers,
  onSelectionChange,
  onTextSelectionChange,
  onExport,
  onExportRequest
}: VisualHtmlEditorProps, ref): React.JSX.Element {
  const snapshot = useEditorSnapshot(controller);
  const editorSnapshot = useMemo(() => readOnly ? {
    ...snapshot,
    profile: {
      ...snapshot.profile,
      capabilities: {
        editText: false,
        editStyles: false,
        insertImages: false,
        replaceImages: false,
        dragElements: false,
        resizeElements: false,
        duplicateElements: false,
        deleteElements: false,
        importHtml: false,
        editSource: false
      }
    }
  } : snapshot, [readOnly, snapshot]);
  const htmlInputRef = useRef<HTMLInputElement>(null);
  const htmlImportButtonRef = useRef<HTMLButtonElement>(null);
  const transientStatusIdRef = useRef(0);
  const [mode, setMode] = useState<'visual' | 'source'>('visual');
  const [sourceDraft, setSourceDraft] = useState(snapshot.html);
  const [notice, setNotice] = useState<string | null>(null);
  const [transientStatus, setTransientStatus] = useState<TransientStatus | null>(null);
  const run = useCallback(async (operation: Promise<{ ok: boolean; message?: string }>) => {
    const result = await operation;
    setNotice(result.ok ? null : result.message ?? 'The operation failed.');
    return result.ok;
  }, []);

  const canvasSelection = useCanvasSelection(controller, snapshot.revision, onSelectionChange);
  const { selectedKey } = canvasSelection;
  const { iframeRef, selectNode } = canvasSelection.runtime;
  const outline = useEditorOutline({
    controller, snapshot: editorSnapshot, selectedKey, selection: canvasSelection.runtime, elementBehaviorResolvers, setMode
  });
  const { outlineNodes, elementBehaviorResolversRef } = outline;
  const textEditing = useTextEditing({
    controller, revision: snapshot.revision, mode, iframeRef, outlineNodes,
    elementBehaviorResolversRef, selectNode, setNotice, run, onTextSelectionChange
  });
  const inspector = useInspectorProperties({
    controller, revision: snapshot.revision, selectedKey, selection: canvasSelection.runtime, setNotice, run
  });
  const { refreshPropertyDrafts } = inspector;
  const layout = useCanvasLayout({ controller, snapshot: editorSnapshot, mode, selectedKey, selection: canvasSelection.runtime, run });

  const selectedNode = useMemo(
    () => editorSnapshot.nodes.find((node) => node.key === selectedKey),
    [editorSnapshot.nodes, selectedKey]
  );
  const onImported = useCallback((message: string) => {
    setMode('visual');
    selectNode(null);
    transientStatusIdRef.current += 1;
    setTransientStatus({ id: transientStatusIdRef.current, message });
  }, [selectNode]);
  const { pendingHtmlImport, isImporting, prepareHtmlImport, confirmHtmlImport, cancelHtmlImport } = useHtmlImport({
    controller, profile: editorSnapshot.profile, dirty: snapshot.dirty, documentTitle, importAdapter, setNotice, onImported
  });

  useEffect(() => {
    setMode('visual');
    setSourceDraft(controller.getSnapshot().html);
  }, [controller]);

  useEffect(() => {
    setNotice(null);
  }, [snapshot.profile.id]);

  useEffect(() => {
    if (!readOnly) return;
    void textEditing.runtime.commitActiveRichTextEdit();
    textEditing.runtime.setRichTextSelection(null);
    setMode('visual');
  }, [readOnly, textEditing.runtime]);

  useEffect(() => {
    if (!transientStatus) return;
    const timeout = window.setTimeout(() => {
      setTransientStatus((current) => current?.id === transientStatus.id ? null : current);
    }, 2800);
    return () => window.clearTimeout(timeout);
  }, [transientStatus]);

  useCanvasRuntime({
    controller, snapshot: editorSnapshot, mode, baseUrl, outlineNodes, elementBehaviorResolversRef,
    selection: canvasSelection.runtime, textEditing: textEditing.runtime, setNotice, refreshPropertyDrafts
  });
  useEditorShortcuts({
    controller, mode, pendingHtmlImport, iframeRef, selectedKey,
    capabilities: editorSnapshot.profile.capabilities, run, runHistory: textEditing.runtime.runHistory
  });

  const commitPendingEdits = useCallback(async () => {
    if (mode === 'source' && sourceDraft !== controller.getSnapshot().html) {
      throw new Error('Apply or cancel the source changes before saving.');
    }
    const committed = await textEditing.runtime.commitActiveRichTextEdit();
    if (!committed) throw new Error('Fix the active text edit before saving.');
  }, [controller, mode, sourceDraft, textEditing.runtime]);

  const { imageInputRef, handleImage, exportHtml } = useEditorFiles({
    controller, snapshot: editorSnapshot, selectedKey, selectedNode, assetAdapter, onExport, onExportRequest, setNotice, run,
    beforeExport: commitPendingEdits
  });

  const openSource = useCallback(async () => {
    try {
      await commitPendingEdits();
      setSourceDraft(controller.getSnapshot().html);
      setMode('source');
      selectNode(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to open the HTML source.');
    }
  }, [commitPendingEdits, controller, selectNode]);

  const applySource = useCallback(async () => {
    if (readOnly) return;
    const success = await run(controller.dispatch({ type: 'applySource', source: sourceDraft }));
    if (success) setMode('visual');
  }, [controller, readOnly, run, sourceDraft]);

  useImperativeHandle(ref, () => ({
    async flush() {
      await commitPendingEdits();
      return controller.export();
    },
    openImportPicker() {
      if (readOnly || !editorSnapshot.profile.capabilities.importHtml) {
        setNotice(readOnly ? 'Turn off read-only mode to import HTML.' : 'HTML import is unavailable for this profile.');
        return;
      }
      htmlInputRef.current?.click();
    },
    getTextSelection() {
      return textEditing.runtime.richTextSelectionRef.current;
    },
    toggleSelectedTextMark(mark, selection) {
      if (readOnly) {
        setNotice('Turn off read-only mode to format text.');
        return Promise.resolve(false);
      }
      return textEditing.runtime.toggleInlineMark(mark, selection);
    },
    setSelectedTextStyles(styles, selection) {
      if (readOnly) {
        setNotice('Turn off read-only mode to format text.');
        return Promise.resolve(false);
      }
      return textEditing.runtime.setInlineStyles(styles, selection);
    }
  }), [commitPendingEdits, controller, editorSnapshot.profile.capabilities.importHtml, readOnly, textEditing.runtime]);

  return (
    <div className={`vhe-root ${className}`} data-testid="visual-html-editor" data-read-only={readOnly || undefined}>
      <EditorToolbar brandHref={brandHref} documentTitle={documentTitle} toolbarContent={toolbarContent}
        profile={editorSnapshot.profile} aspect={layout.aspect} setAspectId={layout.setAspectId}
        htmlImportButtonRef={htmlImportButtonRef} htmlInputRef={htmlInputRef} imageInputRef={imageInputRef}
        exportHtml={exportHtml} importAdapter={importAdapter} prepareHtmlImport={prepareHtmlImport} handleImage={handleImage} />

      {notice && <div className="vhe-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>Dismiss</button></div>}

      {transientStatus && (
        <div className="vhe-toast" role="status" aria-live="polite">
          <span className="vhe-toast__icon" aria-hidden="true"><Check size={13} strokeWidth={2.2} /></span>
          <span>{transientStatus.message}</span>
        </div>
      )}

      {pendingHtmlImport && (
        <HtmlImportDialog pendingHtmlImport={pendingHtmlImport} isImporting={isImporting}
          restoreFocusRef={htmlImportButtonRef} onDismiss={cancelHtmlImport} onConfirm={confirmHtmlImport} />
      )}

      <div className={`vhe-layout${navigationRail ? ' vhe-layout--with-navigation' : ''}`}>
        {navigationRail && <aside className="vhe-navigation">{navigationRail}</aside>}
        <EditorStage documentTitle={documentTitle} mode={mode} setMode={setMode} profile={editorSnapshot.profile}
          selectedNode={selectedNode} selection={canvasSelection} textEditing={textEditing} layout={layout}
          sourceDraft={sourceDraft} setSourceDraft={setSourceDraft} applySource={applySource} />

        <EditorSidebar snapshot={editorSnapshot} selectedKey={selectedKey} selectedNode={selectedNode}
          outline={outline} textEditing={textEditing} inspector={inspector}
          elementBehaviorResolvers={elementBehaviorResolvers} sidebarHeader={sidebarHeader}
          mode={mode} setMode={setMode} openSource={openSource} onImage={() => imageInputRef.current?.click()} readOnly={readOnly} />
      </div>
      <footer className="vhe-status"><span className="vhe-status__save" data-dirty={snapshot.dirty || workspaceDirty}><i />{snapshot.dirty || workspaceDirty ? 'Unsaved changes' : 'Saved checkpoint'}</span><span className="vhe-status__hint">{readOnly ? 'Read-only preview' : 'Your canvas. Your source. Your control.'}</span><span className="vhe-status__validation">{snapshot.issues.length === 0 && <Check size={12} aria-hidden="true" />}{snapshot.issues.length} validation issue{snapshot.issues.length === 1 ? '' : 's'}</span></footer>
    </div>
  );
});
