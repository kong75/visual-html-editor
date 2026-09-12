import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { VisualHtmlEditorProps } from './editor-types.js';
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
  ResolvedAsset, AssetAdapter, EditorSelectionChange, HtmlImportInput,
  HtmlImportPreview, HtmlImportResult, HtmlImportAdapter, VisualHtmlEditorProps
} from './editor-types.js';

interface TransientStatus {
  id: number;
  message: string;
}

const defaultElementBehaviorResolvers: readonly ElementBehaviorResolver[] = [];

export function VisualHtmlEditor({
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
  elementBehaviorResolvers = defaultElementBehaviorResolvers,
  onSelectionChange,
  onExport,
  onExportRequest
}: VisualHtmlEditorProps): React.JSX.Element {
  const snapshot = useEditorSnapshot(controller);
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
    controller, snapshot, selectedKey, selection: canvasSelection.runtime, elementBehaviorResolvers, setMode
  });
  const { outlineNodes, elementBehaviorResolversRef } = outline;
  const textEditing = useTextEditing({
    controller, revision: snapshot.revision, mode, iframeRef, outlineNodes,
    elementBehaviorResolversRef, selectNode, setNotice, run
  });
  const inspector = useInspectorProperties({
    controller, revision: snapshot.revision, selectedKey, selection: canvasSelection.runtime, setNotice, run
  });
  const { refreshPropertyDrafts } = inspector;
  const layout = useCanvasLayout({ controller, snapshot, mode, selectedKey, selection: canvasSelection.runtime, run });

  const selectedNode = useMemo(
    () => snapshot.nodes.find((node) => node.key === selectedKey),
    [selectedKey, snapshot.nodes]
  );
  const onImported = useCallback((message: string) => {
    setMode('visual');
    selectNode(null);
    transientStatusIdRef.current += 1;
    setTransientStatus({ id: transientStatusIdRef.current, message });
  }, [selectNode]);
  const { pendingHtmlImport, isImporting, prepareHtmlImport, confirmHtmlImport, cancelHtmlImport } = useHtmlImport({
    controller, profile: snapshot.profile, dirty: snapshot.dirty, documentTitle, importAdapter, setNotice, onImported
  });

  useEffect(() => {
    setMode('visual');
    setSourceDraft(controller.getSnapshot().html);
  }, [controller]);

  useEffect(() => {
    setNotice(null);
  }, [snapshot.profile.id]);

  useEffect(() => {
    if (!transientStatus) return;
    const timeout = window.setTimeout(() => {
      setTransientStatus((current) => current?.id === transientStatus.id ? null : current);
    }, 2800);
    return () => window.clearTimeout(timeout);
  }, [transientStatus]);

  useCanvasRuntime({
    controller, snapshot, mode, outlineNodes, elementBehaviorResolversRef,
    selection: canvasSelection.runtime, textEditing: textEditing.runtime, setNotice, refreshPropertyDrafts
  });
  useEditorShortcuts({
    controller, mode, pendingHtmlImport, iframeRef, selectedKey,
    capabilities: snapshot.profile.capabilities, run, runHistory: textEditing.runtime.runHistory
  });
  const { imageInputRef, handleImage, exportHtml } = useEditorFiles({
    controller, snapshot, selectedKey, selectedNode, assetAdapter, onExport, onExportRequest, setNotice, run
  });

  const openSource = useCallback(() => {
    setSourceDraft(controller.getSnapshot().html);
    setMode('source');
    selectNode(null);
  }, [controller, selectNode]);

  const applySource = useCallback(async () => {
    const success = await run(controller.dispatch({ type: 'applySource', source: sourceDraft }));
    if (success) setMode('visual');
  }, [controller, run, sourceDraft]);

  return (
    <div className={`vhe-root ${className}`} data-testid="visual-html-editor">
      <EditorToolbar brandHref={brandHref} documentTitle={documentTitle} toolbarContent={toolbarContent}
        profile={snapshot.profile} aspect={layout.aspect} setAspectId={layout.setAspectId}
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
        <EditorStage documentTitle={documentTitle} mode={mode} setMode={setMode} profile={snapshot.profile}
          selectedNode={selectedNode} selection={canvasSelection} layout={layout}
          sourceDraft={sourceDraft} setSourceDraft={setSourceDraft} applySource={applySource} />

        <EditorSidebar snapshot={snapshot} selectedKey={selectedKey} selectedNode={selectedNode}
          outline={outline} textEditing={textEditing} inspector={inspector}
          elementBehaviorResolvers={elementBehaviorResolvers} sidebarHeader={sidebarHeader}
          mode={mode} setMode={setMode} openSource={openSource} onImage={() => imageInputRef.current?.click()} />
      </div>
      <footer className="vhe-status"><span className="vhe-status__save" data-dirty={snapshot.dirty || workspaceDirty}><i />{snapshot.dirty || workspaceDirty ? 'Unsaved changes' : 'Saved checkpoint'}</span><span className="vhe-status__hint">Your canvas. Your source. Your control.</span><span className="vhe-status__validation">{snapshot.issues.length === 0 && <Check size={12} aria-hidden="true" />}{snapshot.issues.length} validation issue{snapshot.issues.length === 1 ? '' : 's'}</span></footer>
    </div>
  );
}
