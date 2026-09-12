import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hardenRuntimeHtml, type InlineMark, type NodeKey, type ParsedNode } from '@visual-html/core';
import { Bold, Check, Code2, Download, Eye, ImagePlus, MousePointer2, Redo2, Undo2, Upload } from 'lucide-react';
import type { VisualHtmlEditorProps } from './editor-types.js';
import { resolveElementBehavior, type ElementBehaviorResolver } from './element-behavior.js';
import { useEditorSnapshot } from './use-editor-snapshot.js';
import { useHtmlImport } from './use-html-import.js';
import { HtmlImportDialog } from './html-import-dialog.js';
import { InspectorBody } from './inspector-body.js';
import { EditorSelect } from './inspector-controls.js';
import { inspectorStyleProperties, normalizeInspectorStyleValue } from './inspector-values.js';
import { fileToDataUrl, downloadHtml } from './browser-files.js';
import { outlineHiddenTags, visibleOutlineNodes, initialCollapsedOutlineKeys, ComponentOutlineNode } from './component-outline.js';
import {
  pointTextOffset, queryRuntimeElement, isRichTextRegion, resolveEditingRegion,
  readRichTextSelection, restoreRichTextSelection, replaceSelectionWithText,
  syncRuntimeSelection, runtimeHitCandidates, cycleHitCandidate, runtimePointerPoint,
  type RichTextSelectionState
} from './runtime-selection.js';
import { BrandMark } from './brand-mark.js';
import { bindRuntimeAttributes, runtimeAttributes, sourceRichTextHtml } from './runtime-attributes.js';
import { layoutDeltaMapper, layoutSize } from './layout-geometry.js';
import { TextEditHistory } from './text-edit-history.js';

export type {
  ResolvedAsset, AssetAdapter, EditorSelectionChange, HtmlImportInput,
  HtmlImportPreview, HtmlImportResult, HtmlImportAdapter, VisualHtmlEditorProps
} from './editor-types.js';

interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ActiveRichTextEdit {
  element: HTMLElement;
  nodeKey: NodeKey;
  originalHtml: string;
  originalDomHtml: string;
  history: TextEditHistory;
}

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
}: VisualHtmlEditorProps) {
  const snapshot = useEditorSnapshot(controller);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageViewportRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);
  const htmlImportButtonRef = useRef<HTMLButtonElement>(null);
  const cleanupFrameRef = useRef<(() => void) | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const selectedKeyRef = useRef<NodeKey | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLButtonElement>(null);
  const overlayFrameRef = useRef<number | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const richTextSelectionRef = useRef<RichTextSelectionState | null>(null);
  const pendingRichTextSelectionRef = useRef<(RichTextSelectionState & { sourceStart?: number }) | null>(null);
  const activeRichTextEditRef = useRef<ActiveRichTextEdit | null>(null);
  const [textHistoryState, setTextHistoryState] = useState({ canUndo: false, canRedo: false });
  const transientStatusIdRef = useRef(0);
  const elementBehaviorResolversRef = useRef(elementBehaviorResolvers);

  const [selectedKey, setSelectedKey] = useState<NodeKey | null>(null);
  const [richTextSelection, setRichTextSelection] = useState<RichTextSelectionState | null>(null);
  const [overlay, setOverlay] = useState<OverlayRect | null>(null);
  const [aspectId, setAspectId] = useState(snapshot.profile.defaultAspectRatioId);
  const [mode, setMode] = useState<'visual' | 'source'>('visual');
  const [sourceDraft, setSourceDraft] = useState(snapshot.html);
  const [notice, setNotice] = useState<string | null>(null);
  const [transientStatus, setTransientStatus] = useState<TransientStatus | null>(null);
  const [propertyDrafts, setPropertyDrafts] = useState<Record<string, string>>({});
  const [computedStyleValues, setComputedStyleValues] = useState<Record<string, string>>({});
  const [renderedStyleDifferences, setRenderedStyleDifferences] = useState<Array<{ property: string; source: string; rendered: string }>>([]);
  const [expandedBoxControl, setExpandedBoxControl] = useState<string | null>(null);
  const [collapsedOutlineKeys, setCollapsedOutlineKeys] = useState<Set<NodeKey>>(() => initialCollapsedOutlineKeys(snapshot.nodes, elementBehaviorResolvers));
  const [canvasScale, setCanvasScale] = useState(1);

  selectedKeyRef.current = selectedKey;
  richTextSelectionRef.current = richTextSelection;
  onSelectionChangeRef.current = onSelectionChange;
  elementBehaviorResolversRef.current = elementBehaviorResolvers;

  const selectedNode = useMemo(
    () => snapshot.nodes.find((node) => node.key === selectedKey),
    [selectedKey, snapshot.nodes]
  );
  const outlineNodes = useMemo(() => new Map(snapshot.nodes.map((node) => [node.key, node])), [snapshot.nodes]);
  const outlineRoots = useMemo(() => {
    const body = snapshot.nodes.find((node) => node.tagName === 'body' && !node.virtual);
    const rootKeys = body?.childKeys ?? snapshot.nodes.filter((node) => !node.parentKey).map((node) => node.key);
    return visibleOutlineNodes(rootKeys, outlineNodes);
  }, [outlineNodes, snapshot.nodes]);
  const outlineNodeCount = useMemo(
    () => snapshot.nodes.filter((node) => !node.virtual && !outlineHiddenTags.has(node.tagName) && node.tagName !== 'body').length,
    [snapshot.nodes]
  );
  const aspect = useMemo(
    () => snapshot.profile.aspectRatios.find((option) => option.id === aspectId) ?? snapshot.profile.aspectRatios[0],
    [aspectId, snapshot.profile.aspectRatios]
  );

  const run = useCallback(async (operation: Promise<{ ok: boolean; message?: string }>) => {
    const result = await operation;
    if (!result.ok) setNotice(result.message ?? 'The operation failed.');
    else setNotice(null);
    return result.ok;
  }, []);

  const commitActiveRichTextEdit = useCallback(async (nodeKey?: NodeKey) => {
    const active = activeRichTextEditRef.current;
    if (!active || (nodeKey && active.nodeKey !== nodeKey)) return true;
    activeRichTextEditRef.current = null;
    setTextHistoryState({ canUndo: false, canRedo: false });
    const html = sourceRichTextHtml(active.element);
    const attrs = runtimeAttributes(active.element.ownerDocument);
    active.element.removeAttribute('contenteditable');
    active.element.removeAttribute(attrs.editing);
    active.element.removeAttribute(attrs.richRegion);
    if (html === active.originalHtml) return true;
    const result = await controller.dispatch({ type: 'setRichText', nodeKey: active.nodeKey, html });
    if (!result.ok) {
      active.element.innerHTML = active.originalDomHtml;
      setNotice(result.message);
    }
    else setNotice(null);
    return result.ok;
  }, [controller]);

  const refreshTextHistory = useCallback(() => {
    const history = activeRichTextEditRef.current?.history;
    setTextHistoryState({ canUndo: history?.canUndo ?? false, canRedo: history?.canRedo ?? false });
  }, []);

  const runHistory = useCallback(async (direction: 'undo' | 'redo') => {
    const active = activeRichTextEditRef.current;
    const rootStart = active ? controller.getNode(active.nodeKey)?.range?.start : undefined;
    if (active?.history[direction]()) {
      refreshTextHistory();
      return true;
    }
    const current = controller.getSnapshot();
    if (direction === 'undo' ? !current.canUndo : !current.canRedo) return false;
    if (active) {
      // A divergent local edit invalidates document redo until it is committed.
      if (direction === 'redo' && sourceRichTextHtml(active.element) !== active.originalHtml) return false;
      const selection = active.element.ownerDocument.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
      const start = range ? pointTextOffset(active.element, range.startContainer, range.startOffset) : undefined;
      const end = range ? pointTextOffset(active.element, range.endContainer, range.endOffset) : undefined;
      if (!await commitActiveRichTextEdit()) return false;
      if (start !== undefined && end !== undefined) pendingRichTextSelectionRef.current = {
        nodeKey: active.nodeKey, range: { start, end },
        sourceStart: rootStart,
        activeMarks: { strong: false, em: false, u: false, s: false }
      };
    }
    const success = await run(controller[direction]());
    if (!success) pendingRichTextSelectionRef.current = null;
    else if (rootStart !== undefined && pendingRichTextSelectionRef.current && !controller.getNode(pendingRichTextSelectionRef.current.nodeKey)) {
      const root = controller.getSnapshot().nodes.find((node) => !node.virtual && node.range?.start === rootStart);
      if (root) pendingRichTextSelectionRef.current = { ...pendingRichTextSelectionRef.current, nodeKey: root.key };
    }
    return success;
  }, [commitActiveRichTextEdit, controller, refreshTextHistory, run]);

  const toggleInlineMark = useCallback(async (mark: InlineMark, selection = richTextSelectionRef.current) => {
    if (!selection) {
      setNotice('Select some text before applying formatting.');
      return false;
    }
    if (!await commitActiveRichTextEdit(selection.nodeKey)) return false;
    const rootStart = controller.getNode(selection.nodeKey)?.range?.start;
    pendingRichTextSelectionRef.current = { ...selection, sourceStart: rootStart };
    const success = await run(controller.dispatch({
      type: 'toggleInlineMark',
      nodeKey: selection.nodeKey,
      range: selection.range,
      mark
    }));
    if (!success) pendingRichTextSelectionRef.current = null;
    else if (rootStart !== undefined && !controller.getNode(selection.nodeKey)) {
      const root = controller.getSnapshot().nodes.find((node) => !node.virtual && node.range?.start === rootStart);
      if (root) pendingRichTextSelectionRef.current = { ...selection, nodeKey: root.key };
    }
    return success;
  }, [commitActiveRichTextEdit, controller, run]);

  const updateOverlay = useCallback((persist = false) => {
    const element = queryRuntimeElement(iframeRef.current, selectedKeyRef.current);
    if (!element || !element.isConnected) {
      setOverlay(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    const next = { left: rect.left, top: rect.top, width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
    const overlayElement = overlayRef.current;
    if (overlayElement) {
      overlayElement.style.transform = `translate3d(${next.left}px, ${next.top}px, 0)`;
      overlayElement.style.width = `${next.width}px`;
      overlayElement.style.height = `${next.height}px`;
    }
    if (resizeHandleRef.current) {
      resizeHandleRef.current.style.transform = `translate3d(${next.left + next.width}px, ${next.top + next.height}px, 0) translate(-50%, -50%)`;
    }
    if (persist || !overlayElement) setOverlay(next);
  }, []);

  const syncOverlay = useCallback(() => {
    if (overlayFrameRef.current !== null) return;
    overlayFrameRef.current = requestAnimationFrame(() => {
      overlayFrameRef.current = null;
      updateOverlay(false);
    });
  }, [updateOverlay]);

  const selectNode = useCallback((key: NodeKey | null) => {
    setSelectedKey(key);
    selectedKeyRef.current = key;
    syncRuntimeSelection(iframeRef.current, key);
    onSelectionChangeRef.current?.({ nodeKey: key, node: key ? controller.getNode(key) : undefined });
    if (!key) {
      setOverlay(null);
      return;
    }
    updateOverlay(true);
    syncOverlay();
  }, [syncOverlay, updateOverlay]);

  const onImported = useCallback((message: string) => {
    setMode('visual');
    selectNode(null);
    transientStatusIdRef.current += 1;
    setTransientStatus({ id: transientStatusIdRef.current, message });
  }, [selectNode]);
  const { pendingHtmlImport, isImporting, prepareHtmlImport, confirmHtmlImport, cancelHtmlImport } = useHtmlImport({
    controller, profile: snapshot.profile, dirty: snapshot.dirty, documentTitle, importAdapter, setNotice, onImported
  });

  const selectOutlineNode = useCallback((key: NodeKey) => {
    setMode('visual');
    selectNode(key);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const element = queryRuntimeElement(iframeRef.current, key);
      element?.scrollIntoView({ block: 'center', inline: 'center' });
      updateOverlay(true);
    }));
  }, [selectNode, updateOverlay]);

  const toggleOutlineNode = useCallback((key: NodeKey) => {
    setCollapsedOutlineKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    activeRichTextEditRef.current = null;
    setTextHistoryState({ canUndo: false, canRedo: false });
    selectNode(null);
    setMode('visual');
    setSourceDraft(controller.getSnapshot().html);
    setPropertyDrafts({});
    setExpandedBoxControl(null);
    setCollapsedOutlineKeys(initialCollapsedOutlineKeys(controller.getSnapshot().nodes, elementBehaviorResolversRef.current));
  }, [controller, selectNode]);

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

  useEffect(() => {
    if (!selectedKey) return;
    setCollapsedOutlineKeys((current) => {
      const next = new Set(current);
      let parentKey = outlineNodes.get(selectedKey)?.parentKey;
      let changed = false;
      while (parentKey) {
        changed = next.delete(parentKey) || changed;
        parentKey = outlineNodes.get(parentKey)?.parentKey;
      }
      return changed ? next : current;
    });
  }, [outlineNodes, selectedKey]);

  useEffect(() => {
    if (!selectedKey) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-outline-node-key="${CSS.escape(selectedKey)}"]`)?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [collapsedOutlineKeys, selectedKey]);

  const refreshPropertyDrafts = useCallback(() => {
    const element = queryRuntimeElement(iframeRef.current, selectedKeyRef.current);
    if (!element) {
      setPropertyDrafts({});
      setComputedStyleValues({});
      setRenderedStyleDifferences([]);
      return;
    }
    const computed = element.ownerDocument.defaultView?.getComputedStyle(element);
    const values: Record<string, string> = {};
    const computedValues: Record<string, string> = {};
    const differences: Array<{ property: string; source: string; rendered: string }> = [];
    for (const property of inspectorStyleProperties) {
      const authored = element.style.getPropertyValue(property);
      const effective = computed?.getPropertyValue(property) || '';
      const value = authored || effective;
      values[property] = normalizeInspectorStyleValue(property, value);
      const rendered = normalizeInspectorStyleValue(property, effective);
      computedValues[property] = rendered;
      if (authored && rendered && values[property] !== rendered) {
        differences.push({ property, source: values[property]!, rendered });
      }
    }
    setPropertyDrafts(values);
    setComputedStyleValues(computedValues);
    setRenderedStyleDifferences(differences);
  }, []);

  useEffect(() => {
    setAspectId(snapshot.profile.defaultAspectRatioId);
  }, [snapshot.profile.defaultAspectRatioId, snapshot.profile.id]);

  useEffect(() => {
    if (mode !== 'visual') return;
    const viewport = stageViewportRef.current;
    if (!viewport) return;

    const fitCanvas = () => {
      const availableWidth = Math.max(1, viewport.clientWidth - 12);
      const availableHeight = Math.max(1, viewport.clientHeight - 12);
      const nextScale = Math.min(1, availableWidth / aspect.width, availableHeight / aspect.height);
      setCanvasScale(Math.max(0.05, Math.floor(nextScale * 1000) / 1000));
    };

    fitCanvas();
    const observer = new ResizeObserver(fitCanvas);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [aspect.height, aspect.width, mode]);

  useEffect(() => {
    if (selectedKey && !controller.getNode(selectedKey)) {
      selectNode(null);
      return;
    }
  }, [controller, selectNode, selectedKey, snapshot.revision]);

  useEffect(() => {
    const frame = iframeRef.current;
    const writableDoc = frame?.contentDocument;
    if (!frame || !writableDoc || mode !== 'visual') return;

    cleanupFrameRef.current?.();
    resizeObserverRef.current?.disconnect();
    writableDoc.open();
    writableDoc.write(hardenRuntimeHtml(snapshot.projection.html));
    writableDoc.close();

    // WebKit may replace the iframe Document during document.open()/write().
    // Always bind runtime state and events to the live document after writing.
    const doc = frame.contentDocument;
    if (!doc) return;
    const attrs = bindRuntimeAttributes(doc, snapshot.projection.runtimeAttribute);

    const runtimeStyle = doc.createElement('style');
    runtimeStyle.setAttribute(attrs.runtime, 'true');
    runtimeStyle.textContent = `
      html, body { min-height: 100%; }
      [${attrs.editing}="true"] {
        outline: none !important;
        caret-color: #7652ba;
        cursor: text !important;
      }
      [${attrs.node}][${attrs.interaction}="text"]:not([${attrs.editing}="true"]) { cursor: text; }
      /* Keep empty text blocks reachable without adding content or styles to the source. */
      [${attrs.node}][${attrs.interaction}="text"]:empty:is(p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, div, section, figcaption) {
        min-height: 1em;
      }
      [${attrs.node}][${attrs.interaction}="select"]:not([${attrs.selected}="true"]) { cursor: default; }
      ${snapshot.profile.capabilities.dragElements ? `
        [${attrs.node}] { touch-action: none; }
        [${attrs.node}][${attrs.interaction}="select"][${attrs.selected}="true"] { cursor: move; }
        html[${attrs.dragActive}="true"], html[${attrs.dragActive}="true"] * { cursor: grabbing !important; }
        [${attrs.dragging}="true"] {
          cursor: grabbing !important;
          user-select: none !important;
          translate: var(--vhe-drag-x, 0px) var(--vhe-drag-y, 0px);
          will-change: translate;
        }
      ` : ''}
    `;
    doc.head.append(runtimeStyle);

    for (const element of doc.querySelectorAll<HTMLElement>(`[${attrs.node}]`)) {
      const key = element.getAttribute(attrs.node);
      const node = key ? controller.getNode(key) : undefined;
      const directlyEditable = Boolean(snapshot.profile.capabilities.editText && node?.innerRange && (!node.hasElementChildren || isRichTextRegion(node, controller)));
      element.setAttribute(attrs.interaction, directlyEditable ? 'text' : 'select');
    }
    syncRuntimeSelection(frame, selectedKeyRef.current);

    let activeDragCleanup: (() => void) | null = null;
    let suppressClick = false;
    let suppressClickTimer: number | null = null;

    const suppressUpcomingClick = () => {
      suppressClick = true;
      if (suppressClickTimer !== null) doc.defaultView?.clearTimeout(suppressClickTimer);
      suppressClickTimer = doc.defaultView?.setTimeout(() => {
        suppressClick = false;
        suppressClickTimer = null;
      }, 150) ?? null;
    };

    const beginInlineEdit = (
      candidateElement: HTMLElement,
      candidateKey: NodeKey,
      candidateNode: ParsedNode,
      clientX?: number,
      clientY?: number,
      reportUnsupported = false
    ): boolean => {
      if (!snapshot.profile.capabilities.editText) return false;
      const region = resolveEditingRegion(candidateElement, candidateKey, candidateNode, controller, outlineNodes, elementBehaviorResolversRef.current);
      const editable = region.element;
      const key = region.key;
      const node = region.node;
      const richRegion = node.hasElementChildren && isRichTextRegion(node, controller);
      if ((node.hasElementChildren && !richRegion) || !node.innerRange) {
        if (reportUnsupported) setNotice('This element contains nested markup. Use source mode for this MVP.');
        return false;
      }

      selectNode(key);
      editable.contentEditable = 'true';
      editable.setAttribute(attrs.editing, 'true');
      // Leaf text and mixed inline markup use the same source-preserving
      // commit path, so newly inserted line breaks are not flattened to text.
      editable.setAttribute(attrs.richRegion, 'true');
      activeRichTextEditRef.current = { element: editable, nodeKey: key, originalHtml: sourceRichTextHtml(editable), originalDomHtml: editable.innerHTML, history: new TextEditHistory(editable) };
      refreshTextHistory();
      editable.focus({ preventScroll: true });

      const selection = doc.defaultView?.getSelection();
      if (!selection) return true;
      let range: Range | null = null;

      if (clientX !== undefined && clientY !== undefined) {
        const position = doc.caretPositionFromPoint(clientX, clientY);
        if (position && editable.contains(position.offsetNode)) {
          range = doc.createRange();
          range.setStart(position.offsetNode, position.offset);
          range.collapse(true);
        } else {
          const candidate = doc.caretRangeFromPoint(clientX, clientY);
          if (candidate && editable.contains(candidate.startContainer)) range = candidate;
        }
      }

      if (!range) {
        range = doc.createRange();
        range.selectNodeContents(editable);
        range.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!snapshot.profile.capabilities.dragElements || event.button !== 0) return;
      const target = event.target;
      const FrameHTMLElement = doc.defaultView?.HTMLElement;
      if (!FrameHTMLElement || !(target instanceof FrameHTMLElement)) return;
      const activeEditing = target.closest<HTMLElement>(`[${attrs.editing}="true"]`);
      if (activeEditing && !event.altKey) return;
      if (activeEditing) activeEditing.blur();

      const startPoint = runtimePointerPoint(frame, doc, event, target);
      const candidates = runtimeHitCandidates(doc, controller, startPoint.x, startPoint.y);
      const cycledCandidate = cycleHitCandidate(candidates, selectedKeyRef.current);
      const selectedCandidate = candidates.find((candidate) => candidate.key === selectedKeyRef.current);
      const dragCandidate = event.altKey ? cycledCandidate : selectedCandidate ?? candidates[0];
      if (!dragCandidate) return;
      const { element: editable, key, node } = dragCandidate;

      event.preventDefault();
      activeDragCleanup?.();
      selectNode(key);

      const computed = doc.defaultView?.getComputedStyle(editable);
      const originalPosition = computed?.position ?? 'static';
      const position = originalPosition === 'static' ? 'relative' : originalPosition;
      const isOutOfFlow = position === 'absolute' || position === 'fixed';
      const computedLeft = Number.parseFloat(computed?.left ?? '');
      const computedTop = Number.parseFloat(computed?.top ?? '');
      const computedRight = Number.parseFloat(computed?.right ?? '');
      const computedBottom = Number.parseFloat(computed?.bottom ?? '');
      const startLeft = isOutOfFlow
        ? (Number.isFinite(computedLeft) ? computedLeft : editable.offsetLeft)
        : originalPosition === 'static' ? 0 : Number.isFinite(computedLeft) ? computedLeft : Number.isFinite(computedRight) ? -computedRight : 0;
      const startTop = isOutOfFlow
        ? (Number.isFinite(computedTop) ? computedTop : editable.offsetTop)
        : originalPosition === 'static' ? 0 : Number.isFinite(computedTop) ? computedTop : Number.isFinite(computedBottom) ? -computedBottom : 0;
      const localDelta = layoutDeltaMapper(editable, false);
      const startX = startPoint.x;
      const startY = startPoint.y;
      const startRect = editable.getBoundingClientRect();
      let dragging = false;
      let lastDeltaX = 0;
      let lastDeltaY = 0;

      const clearPreview = () => {
        editable.removeAttribute(attrs.dragging);
        editable.style.removeProperty('--vhe-drag-x');
        editable.style.removeProperty('--vhe-drag-y');
        doc.documentElement.removeAttribute(attrs.dragActive);
      };

      const cleanup = () => {
        doc.removeEventListener('pointermove', move, true);
        doc.removeEventListener('pointerup', end, true);
        doc.removeEventListener('pointercancel', end, true);
      };

      const cancel = () => {
        cleanup();
        clearPreview();
        updateOverlay(true);
        if (activeDragCleanup === cancel) activeDragCleanup = null;
      };

      const move = (moveEvent: PointerEvent) => {
        const movePoint = runtimePointerPoint(frame, doc, moveEvent, target, startPoint.space);
        const deltaX = movePoint.x - startX;
        const deltaY = movePoint.y - startY;
        if (!dragging && Math.hypot(deltaX, deltaY) < 4) return;
        if (!dragging) {
          dragging = true;
          editable.setAttribute(attrs.dragging, 'true');
          editable.style.setProperty('--vhe-drag-x', '0px');
          editable.style.setProperty('--vhe-drag-y', '0px');
          doc.documentElement.setAttribute(attrs.dragActive, 'true');
        }
        const delta = localDelta(deltaX, deltaY);
        lastDeltaX = delta.x;
        lastDeltaY = delta.y;
        editable.style.setProperty('--vhe-drag-x', `${Math.round(delta.x)}px`);
        editable.style.setProperty('--vhe-drag-y', `${Math.round(delta.y)}px`);
        const selection = overlayRef.current;
        if (selection) {
          selection.style.transform = `translate3d(${startRect.left + deltaX}px, ${startRect.top + deltaY}px, 0)`;
        }
        if (resizeHandleRef.current) {
          resizeHandleRef.current.style.transform = `translate3d(${startRect.right + deltaX}px, ${startRect.bottom + deltaY}px, 0) translate(-50%, -50%)`;
        }
      };

      const end = async (endEvent: PointerEvent) => {
        cleanup();
        if (activeDragCleanup === cancel) activeDragCleanup = null;
        if (endEvent.type === 'pointercancel') {
          clearPreview();
          updateOverlay(true);
          return;
        }
        if (!dragging) {
          clearPreview();
          const clickCandidate = event.altKey ? cycledCandidate : candidates[0];
          if (clickCandidate) {
            if (event.altKey) selectNode(clickCandidate.key);
            else beginInlineEdit(clickCandidate.element, clickCandidate.key, clickCandidate.node, startPoint.x, startPoint.y, false);
          }
          suppressUpcomingClick();
          return;
        }
        const styles: Record<string, string | null> = {
          position,
          left: `${Math.round(startLeft + lastDeltaX)}px`,
          top: `${Math.round(startTop + lastDeltaY)}px`
        };
        // Override stylesheet constraints as well as inline offsets (including RTL).
        if (Number.isFinite(computedRight)) styles.right = 'auto';
        if (Number.isFinite(computedBottom)) styles.bottom = 'auto';
        suppressUpcomingClick();
        // Finish pointerup before replacing the iframe document. Firefox keeps
        // its mouse capture until the event completes; rewriting here can send
        // the next toolbar click to the discarded document instead.
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        if (!editable.isConnected || frame.contentDocument !== doc) return;
        const result = await controller.dispatch({ type: 'setStyles', nodeKey: key, styles }, snapshot.revision);
        clearPreview();
        suppressUpcomingClick();
        syncOverlay();
        if (!result.ok) setNotice(result.message);
        else setNotice(null);
      };

      activeDragCleanup = cancel;
      doc.addEventListener('pointermove', move, true);
      doc.addEventListener('pointerup', end, { capture: true, once: true });
      doc.addEventListener('pointercancel', end, { capture: true, once: true });
    };

    const handleNativeDrag = (event: DragEvent) => {
      if (!snapshot.profile.capabilities.dragElements) return;
      const target = event.target;
      const FrameHTMLElement = doc.defaultView?.HTMLElement;
      if (FrameHTMLElement && target instanceof FrameHTMLElement && target.closest(`[${attrs.node}]`)) {
        event.preventDefault();
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        return;
      }
      const target = event.target;
      const FrameHTMLElement = doc.defaultView?.HTMLElement;
      if (!FrameHTMLElement || !(target instanceof FrameHTMLElement)) return;
      if (target.closest('a')) event.preventDefault();
      const activeEditing = target.closest<HTMLElement>(`[${attrs.editing}="true"]`);
      if (activeEditing && !event.altKey) return;
      if (activeEditing) activeEditing.blur();

      const point = runtimePointerPoint(frame, doc, event, target);
      const candidates = runtimeHitCandidates(doc, controller, point.x, point.y);
      const candidate = event.altKey ? cycleHitCandidate(candidates, selectedKeyRef.current) : candidates[0];
      selectNode(candidate?.key ?? null);
      if (!snapshot.profile.capabilities.dragElements && !event.altKey && candidate) {
        beginInlineEdit(candidate.element, candidate.key, candidate.node, point.x, point.y, false);
      }
    };

    const handleDoubleClick = (event: MouseEvent) => {
      if (!snapshot.profile.capabilities.editText) return;
      const target = event.target;
      const FrameHTMLElement = doc.defaultView?.HTMLElement;
      if (!FrameHTMLElement || !(target instanceof FrameHTMLElement)) return;
      const editable = target.closest<HTMLElement>(`[${attrs.node}]`);
      const key = editable?.getAttribute(attrs.node);
      const node = key ? controller.getNode(key) : undefined;
      if (!editable || !key || !node) return;
      if (editable.getAttribute(attrs.editing) === 'true') return;
      event.preventDefault();
      const point = runtimePointerPoint(frame, doc, event, target);
      beginInlineEdit(editable, key, node, point.x, point.y, true);
    };

    const handleSelectionChange = () => {
      const next = readRichTextSelection(doc, controller, outlineNodes, elementBehaviorResolversRef.current);
      richTextSelectionRef.current = next;
      setRichTextSelection(next);
      if (next && selectedKeyRef.current !== next.nodeKey) selectNode(next.nodeKey);
    };

    const handleFocusOut = async (event: FocusEvent) => {
      const target = event.target;
      const FrameHTMLElement = doc.defaultView?.HTMLElement;
      if (!FrameHTMLElement || !(target instanceof FrameHTMLElement) || target.getAttribute(attrs.editing) !== 'true') return;
      const key = target.getAttribute(attrs.node);
      target.removeAttribute('contenteditable');
      target.removeAttribute(attrs.editing);
      target.removeAttribute(attrs.richRegion);
      if (!key) return;
      await commitActiveRichTextEdit(key);
    };

    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target;
      const FrameHTMLElement = doc.defaultView?.HTMLElement;
      if (!FrameHTMLElement || !(target instanceof FrameHTMLElement) || !target.isContentEditable) return;
      event.preventDefault();
      activeRichTextEditRef.current?.history.before('insertFromPaste');
      replaceSelectionWithText(doc, event.clipboardData?.getData('text/plain') ?? '');
      activeRichTextEditRef.current?.history.after();
      refreshTextHistory();
    };

    let composing = false;
    const handleInput = () => {
      if (composing) return;
      activeRichTextEditRef.current?.history.after();
      refreshTextHistory();
      syncOverlay();
    };
    const handleCompositionStart = () => {
      composing = true;
      activeRichTextEditRef.current?.history.before('composition');
    };
    const handleCompositionEnd = () => {
      composing = false;
      handleInput();
    };

    const handleBeforeInput = (event: InputEvent) => {
      const target = event.target;
      const FrameHTMLElement = doc.defaultView?.HTMLElement;
      if (!FrameHTMLElement || !(target instanceof FrameHTMLElement) || !target.closest(`[${attrs.richRegion}="true"]`)) return;
      if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
        event.preventDefault();
        void runHistory(event.inputType === 'historyUndo' ? 'undo' : 'redo');
        return;
      }
      if (event.inputType !== 'formatBold') activeRichTextEditRef.current?.history.before(event.inputType);
      if (!event.isComposing && ['insertParagraph', 'insertLineBreak'].includes(event.inputType)) {
        event.preventDefault();
        replaceSelectionWithText(doc, '\n');
        handleInput();
        return;
      }
      if (event.inputType === 'formatBold') {
        event.preventDefault();
        const selection = readRichTextSelection(doc, controller, outlineNodes, elementBehaviorResolversRef.current);
        if (selection) void toggleInlineMark('strong', selection);
        return;
      }
      if (!event.isComposing && ['insertText', 'insertReplacementText'].includes(event.inputType) && event.data !== null) {
        event.preventDefault();
        replaceSelectionWithText(doc, event.data);
        handleInput();
        return;
      }
      const selection = doc.defaultView?.getSelection();
      if (event.inputType.startsWith('delete') && selection && !selection.isCollapsed) {
        event.preventDefault();
        replaceSelectionWithText(doc, '');
        handleInput();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const FrameHTMLElement = doc.defaultView?.HTMLElement;
      const target = FrameHTMLElement && event.target instanceof FrameHTMLElement ? event.target : null;
      const keyName = event.key.toLowerCase();
      if (!event.isComposing && (event.ctrlKey || event.metaKey) && (keyName === 'z' || keyName === 'y') && !target?.closest('input, textarea, select')) {
        event.preventDefault();
        void runHistory(keyName === 'y' || event.shiftKey ? 'redo' : 'undo');
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        const nativeSelection = readRichTextSelection(doc, controller, outlineNodes, elementBehaviorResolversRef.current);
        const rememberedSelection = richTextSelectionRef.current;
        const targetKey = target?.closest<HTMLElement>(`[${attrs.node}]`)?.getAttribute(attrs.node);
        const selection = nativeSelection ?? (rememberedSelection?.nodeKey === targetKey ? rememberedSelection : null);
        if (selection) {
          event.preventDefault();
          void toggleInlineMark('strong', selection);
          return;
        }
      }
      if (event.key === 'Escape' && target?.isContentEditable) {
        target.blur();
        return;
      }
      if (target?.isContentEditable || target?.closest('input, textarea, select')) return;
      const key = selectedKeyRef.current;
      if (!key) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && snapshot.profile.capabilities.duplicateElements) {
        event.preventDefault();
        void controller.dispatch({ type: 'duplicateNode', nodeKey: key }).then((result) => {
          if (!result.ok) setNotice(result.message);
        });
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && snapshot.profile.capabilities.deleteElements) {
        event.preventDefault();
        void controller.dispatch({ type: 'removeNode', nodeKey: key }).then((result) => {
          if (!result.ok) setNotice(result.message);
        });
      }
    };
    const handleGeometryChange = () => syncOverlay();

    doc.addEventListener('pointerdown', handlePointerDown, true);
    doc.addEventListener('dragstart', handleNativeDrag, true);
    doc.addEventListener('click', handleClick, true);
    doc.addEventListener('dblclick', handleDoubleClick, true);
    doc.addEventListener('selectionchange', handleSelectionChange);
    doc.addEventListener('focusout', handleFocusOut, true);
    doc.addEventListener('paste', handlePaste, true);
    doc.addEventListener('beforeinput', handleBeforeInput, true);
    doc.addEventListener('input', handleInput, true);
    doc.addEventListener('compositionstart', handleCompositionStart, true);
    doc.addEventListener('compositionend', handleCompositionEnd, true);
    doc.addEventListener('keydown', handleKeyDown, true);
    doc.addEventListener('scroll', handleGeometryChange, true);

    const ResizeObserverConstructor = doc.defaultView?.ResizeObserver ?? window.ResizeObserver;
    if (ResizeObserverConstructor && doc.body) {
      resizeObserverRef.current = new ResizeObserverConstructor(handleGeometryChange);
      resizeObserverRef.current.observe(doc.body);
    }
    cleanupFrameRef.current = () => {
      activeDragCleanup?.();
      if (suppressClickTimer !== null) doc.defaultView?.clearTimeout(suppressClickTimer);
      doc.removeEventListener('pointerdown', handlePointerDown, true);
      doc.removeEventListener('dragstart', handleNativeDrag, true);
      doc.removeEventListener('click', handleClick, true);
      doc.removeEventListener('dblclick', handleDoubleClick, true);
      doc.removeEventListener('selectionchange', handleSelectionChange);
      doc.removeEventListener('focusout', handleFocusOut, true);
      doc.removeEventListener('paste', handlePaste, true);
      doc.removeEventListener('beforeinput', handleBeforeInput, true);
      doc.removeEventListener('input', handleInput, true);
      doc.removeEventListener('compositionstart', handleCompositionStart, true);
      doc.removeEventListener('compositionend', handleCompositionEnd, true);
      doc.removeEventListener('keydown', handleKeyDown, true);
      doc.removeEventListener('scroll', handleGeometryChange, true);
    };
    requestAnimationFrame(() => {
      syncOverlay();
      refreshPropertyDrafts();
    });

    return () => cleanupFrameRef.current?.();
  }, [commitActiveRichTextEdit, controller, mode, outlineNodes, refreshPropertyDrafts, refreshTextHistory, runHistory, selectNode, snapshot.profile.capabilities.deleteElements, snapshot.profile.capabilities.dragElements, snapshot.profile.capabilities.duplicateElements, snapshot.profile.capabilities.editText, snapshot.profile.id, snapshot.projection.html, snapshot.revision, syncOverlay, toggleInlineMark, updateOverlay]);

  useEffect(() => {
    const pending = pendingRichTextSelectionRef.current;
    if (!pending || mode !== 'visual') return;
    pendingRichTextSelectionRef.current = null;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      const node = controller.getNode(pending.nodeKey) ?? (pending.sourceStart === undefined ? undefined
        : controller.getSnapshot().nodes.find((candidate) => !candidate.virtual && candidate.range?.start === pending.sourceStart));
      const element = queryRuntimeElement(iframeRef.current, node?.key ?? null);
      if (!element || !node) return;
      const attrs = runtimeAttributes(element.ownerDocument);
      element.contentEditable = 'true';
      element.setAttribute(attrs.editing, 'true');
      element.setAttribute(attrs.richRegion, 'true');
      activeRichTextEditRef.current = { element, nodeKey: node.key, originalHtml: sourceRichTextHtml(element), originalDomHtml: element.innerHTML, history: new TextEditHistory(element) };
      refreshTextHistory();
      element.focus({ preventScroll: true });
      if (!restoreRichTextSelection(element, pending.range)) return;
      const next = readRichTextSelection(element.ownerDocument, controller, outlineNodes, elementBehaviorResolversRef.current);
      richTextSelectionRef.current = next;
      setRichTextSelection(next);
      selectNode(node.key);
    }));
    return () => cancelAnimationFrame(frame);
  }, [controller, mode, outlineNodes, refreshTextHistory, selectNode, snapshot.revision]);

  useEffect(() => {
    refreshPropertyDrafts();
  }, [refreshPropertyDrafts, selectedKey, snapshot.revision]);

  useEffect(() => {
    const handleResize = () => syncOverlay();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (overlayFrameRef.current !== null) cancelAnimationFrame(overlayFrameRef.current);
    };
  }, [syncOverlay]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (mode !== 'visual' || pendingHtmlImport || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const editorRoot = iframeRef.current?.closest('.vhe-root');
      if (target && editorRoot?.contains(target) && !target.closest('input, textarea, select, [contenteditable="true"]') && (event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        void runHistory(event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo');
        return;
      }
      if (!selectedKey || !target?.closest('.vhe-outline') || target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && snapshot.profile.capabilities.duplicateElements) {
        event.preventDefault();
        void run(controller.dispatch({ type: 'duplicateNode', nodeKey: selectedKey }));
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && snapshot.profile.capabilities.deleteElements) {
        event.preventDefault();
        void run(controller.dispatch({ type: 'removeNode', nodeKey: selectedKey }));
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [controller, mode, pendingHtmlImport, run, runHistory, selectedKey, snapshot.profile.capabilities.deleteElements, snapshot.profile.capabilities.duplicateElements]);

  const applyStyle = useCallback(async (property: string, value: string) => {
    if (!selectedKey) return;
    const nextValue = value.trim();
    if (nextValue && !CSS.supports(property, nextValue.replace(/\s*!important\s*$/i, ''))) {
      setNotice(`“${nextValue}” is not valid for ${property}. The previous value is unchanged.`);
      refreshPropertyDrafts();
      return;
    }
    await run(controller.dispatch({ type: 'setStyle', nodeKey: selectedKey, property, value: nextValue || null }));
  }, [controller, refreshPropertyDrafts, run, selectedKey]);

  const applyAttribute = useCallback(async (name: string, value: string) => {
    if (!selectedKey) return;
    await run(controller.dispatch(name === 'src' && controller.getNode(selectedKey)?.tagName === 'img'
      ? { type: 'replaceImage', nodeKey: selectedKey, src: value.trim() || null }
      : { type: 'setAttribute', nodeKey: selectedKey, name, value: value.trim() || null }));
  }, [controller, run, selectedKey]);

  const startResize = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!selectedKey || !snapshot.profile.capabilities.resizeElements) return;
    const element = queryRuntimeElement(iframeRef.current, selectedKey);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const ownerDocument = handle.ownerDocument;
    const root = handle.closest<HTMLElement>('.vhe-root');
    const pointerId = event.pointerId;
    const size = layoutSize(element);
    const localDelta = layoutDeltaMapper(element, true);
    const originalStyle = element.getAttribute('style');
    const startX = event.clientX;
    const startY = event.clientY;

    handle.setAttribute('data-vhe-resizing', 'true');
    root?.setAttribute('data-vhe-resizing', 'true');
    try { handle.setPointerCapture(pointerId); } catch { /* Pointer capture is an enhancement. */ }

    let active = true;
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const delta = localDelta((moveEvent.clientX - startX) / canvasScale, (moveEvent.clientY - startY) / canvasScale);
      element.style.width = `${Math.max(16, Math.round(size.width + delta.x))}px`;
      element.style.height = `${Math.max(16, Math.round(size.height + delta.y))}px`;
      syncOverlay();
    };
    const end = async (endEvent: PointerEvent) => {
      if (!active || endEvent.pointerId !== pointerId) return;
      active = false;
      ownerDocument.removeEventListener('pointermove', move, true);
      ownerDocument.removeEventListener('pointerup', end, true);
      ownerDocument.removeEventListener('pointercancel', end, true);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      handle.removeAttribute('data-vhe-resizing');
      root?.removeAttribute('data-vhe-resizing');
      const styles = { width: element.style.width, height: element.style.height };
      if (originalStyle === null) element.removeAttribute('style');
      else element.setAttribute('style', originalStyle);
      updateOverlay(true);
      if (endEvent.type === 'pointercancel') return;
      await run(controller.dispatch({
        type: 'setStyles',
        nodeKey: selectedKey,
        styles
      }));
    };
    ownerDocument.addEventListener('pointermove', move, true);
    ownerDocument.addEventListener('pointerup', end, true);
    ownerDocument.addEventListener('pointercancel', end, true);
  }, [canvasScale, controller, run, selectedKey, snapshot.profile.capabilities.resizeElements, syncOverlay, updateOverlay]);

  const handleImage = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice('Please choose an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice('Images must be 10 MB or smaller.');
      return;
    }
    try {
      const asset = assetAdapter
        ? await assetAdapter.upload(file)
        : { url: await fileToDataUrl(file), alt: file.name.replace(/\.[^.]+$/, '') };
      if (selectedNode?.tagName === 'img' && snapshot.profile.capabilities.replaceImages) {
        await run(controller.dispatch({ type: 'replaceImage', nodeKey: selectedNode.key, src: asset.url, alt: asset.alt ?? file.name }));
      } else {
        await run(controller.dispatch({
          type: 'insertImage',
          targetNodeKey: selectedKey ?? undefined,
          src: asset.url,
          alt: asset.alt ?? file.name
        }));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Image upload failed.');
    }
  }, [assetAdapter, controller, run, selectedKey, selectedNode, snapshot.profile.capabilities.replaceImages]);

  const openSource = useCallback(() => {
    setSourceDraft(controller.getSnapshot().html);
    setMode('source');
    selectNode(null);
  }, [controller, selectNode]);

  const applySource = useCallback(async () => {
    const success = await run(controller.dispatch({ type: 'applySource', source: sourceDraft }));
    if (success) setMode('visual');
  }, [controller, run, sourceDraft]);

  const exportHtml = useCallback(async () => {
    try {
      const result = await controller.export();
      const blocking = result.issues.filter((issue) => issue.severity === 'blocking');
      if (blocking.length > 0) {
        setNotice(`Export blocked by ${blocking.length} policy issue${blocking.length === 1 ? '' : 's'}.`);
        return;
      }
      if (onExportRequest) {
        await onExportRequest();
        return;
      }
      onExport?.(result.html);
      downloadHtml(result.html, `visual-html-${snapshot.profile.id}.html`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'HTML export failed.');
    }
  }, [controller, onExport, onExportRequest, snapshot.profile.id]);

  const updateStyleDraft = (property: string, value: string) => {
    setPropertyDrafts((current) => ({ ...current, [property]: value }));
  };
  const canToggleBold = Boolean(richTextSelection && snapshot.profile.html.allowedTags.includes('strong'));
  const inspectorTitle = selectedNode
    ? resolveElementBehavior(selectedNode, outlineNodes, elementBehaviorResolvers).kind
    : 'Properties';

  return (
    <div className={`vhe-root ${className}`} data-testid="visual-html-editor">
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
            options={snapshot.profile.aspectRatios.map((option) => ({
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
        <div className="vhe-toolbar__actions">
          {snapshot.profile.capabilities.importHtml && (
            <button ref={htmlImportButtonRef} type="button" className="vhe-button vhe-toolbar__action vhe-toolbar__action--import" aria-label="Import HTML" title="Import HTML" onClick={() => htmlInputRef.current?.click()}><Upload size={15} strokeWidth={1.8} aria-hidden="true" /><span>Import HTML</span></button>
          )}
          <button type="button" className="vhe-button vhe-button--primary vhe-toolbar__action vhe-toolbar__action--export" aria-label="Export HTML" title="Export HTML" onClick={exportHtml}><Download size={15} strokeWidth={1.8} aria-hidden="true" /><span>Export HTML</span></button>
        </div>
        <input ref={htmlInputRef} className="vhe-hidden" type="file" accept={importAdapter?.accept ?? '.html,.htm,text/html,application/xhtml+xml'} aria-label="Import HTML file" onChange={prepareHtmlImport} />
        <input ref={imageInputRef} className="vhe-hidden" type="file" accept="image/*" aria-label="Choose image file" onChange={handleImage} />
      </header>

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
        <main className={`vhe-stage${mode === 'source' ? ' vhe-stage--source' : ''}`}>
          <div className="vhe-canvas-bar">
            <div className="vhe-canvas-bar__document"><Code2 size={14} aria-hidden="true" /><span>{documentTitle}</span><span className="vhe-canvas-bar__divider">/</span><strong>{mode === 'visual' ? 'Canvas' : 'Source'}</strong></div>
            <div className="vhe-canvas-bar__info"><span>{aspect.width} × {aspect.height}</span>{mode === 'visual' && <span className="vhe-canvas-bar__scale">{Math.round(canvasScale * 100)}%</span>}</div>
          </div>
          {mode === 'visual' ? (
            <div ref={stageViewportRef} className="vhe-stage__viewport">
              <div className="vhe-frame-sizer" style={{ width: aspect.width * canvasScale, height: aspect.height * canvasScale }}>
                <div className="vhe-frame-shell" style={{ width: aspect.width, height: aspect.height, transform: `scale(${canvasScale})` }}>
                  <iframe ref={iframeRef} title="Visual HTML canvas" className="vhe-frame" sandbox="allow-same-origin allow-scripts" />
                  {selectedNode && overlay && (
                    <div
                      ref={overlayRef}
                      className="vhe-selection"
                      style={{
                        transform: `translate3d(${overlay.left}px, ${overlay.top}px, 0)`,
                        width: overlay.width,
                        height: overlay.height,
                        '--vhe-overlay-stroke': `${1.5 / canvasScale}px`,
                        '--vhe-overlay-halo': `${2.5 / canvasScale}px`
                      } as React.CSSProperties}
                    />
                  )}
                  {selectedNode && overlay && snapshot.profile.capabilities.resizeElements && (
                    <button
                      ref={resizeHandleRef}
                      type="button"
                      className="vhe-selection__resize"
                      style={{
                        transform: `translate3d(${overlay.left + overlay.width}px, ${overlay.top + overlay.height}px, 0) translate(-50%, -50%)`,
                        '--vhe-overlay-handle-size': `${10 / canvasScale}px`,
                        '--vhe-overlay-handle-stroke': `${2 / canvasScale}px`
                      } as React.CSSProperties}
                      onPointerDown={startResize}
                      aria-label="Resize element"
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <section className="vhe-source">
              <div className="vhe-source__header">
                <div><strong>HTML source</strong><p>Source changes are applied as one revision.</p></div>
                <div><button type="button" className="vhe-button" onClick={() => setMode('visual')}>Cancel</button><button type="button" className="vhe-button vhe-button--primary" onClick={applySource}>Apply</button></div>
              </div>
              <textarea aria-label="HTML source" value={sourceDraft} onChange={(event) => setSourceDraft(event.target.value)} spellCheck={false} />
            </section>
          )}
        </main>

        <aside className="vhe-inspector">
          {sidebarHeader && <div className="vhe-inspector__context">{sidebarHeader}</div>}
          <section className="vhe-outline" aria-label="Layer selector">
            <header className="vhe-outline__header"><strong>Layers</strong><span>{outlineNodeCount}</span></header>
            <div className="vhe-outline__tree" role="tree" aria-label="Document structure">
              {outlineRoots.map((node) => (
                <ComponentOutlineNode
                  key={node.key}
                  node={node}
                  nodes={outlineNodes}
                  selectedKey={selectedKey}
                  collapsedKeys={collapsedOutlineKeys}
                  depth={0}
                  behaviorResolvers={elementBehaviorResolvers}
                  onSelect={selectOutlineNode}
                  onToggle={toggleOutlineNode}
                />
              ))}
            </div>
          </section>
          <div className="vhe-inspector__title">
            <div className="vhe-inspector__title-copy"><span>{inspectorTitle}</span>{selectedNode && <code>{selectedNode.tagName}</code>}</div>
            <div className="vhe-inspector__tools" role="toolbar" aria-label="Editing tools">
              <div className="vhe-inspector__tool-group">
                {snapshot.profile.capabilities.editText && (
                  <button
                    type="button"
                    className={`vhe-tool-button${richTextSelection?.activeMarks.strong ? ' vhe-tool-button--active' : ''}`}
                    disabled={!canToggleBold}
                    aria-label="Bold selected text"
                    aria-pressed={richTextSelection?.activeMarks.strong ?? false}
                    title="Bold · Ctrl+B"
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => void toggleInlineMark('strong')}
                  >
                    <Bold size={14} strokeWidth={2.1} aria-hidden="true" />
                  </button>
                )}
                {snapshot.profile.capabilities.insertImages && <button type="button" className="vhe-tool-button" onClick={() => imageInputRef.current?.click()} aria-label="Image" title="Insert image"><ImagePlus size={15} strokeWidth={1.8} aria-hidden="true" /></button>}
                {snapshot.profile.capabilities.editSource && (
                  <button type="button" className={`vhe-tool-button${mode === 'source' ? ' vhe-tool-button--active' : ''}`} onClick={mode === 'visual' ? openSource : () => setMode('visual')} aria-label={mode === 'visual' ? 'Source' : 'Visual'} title={mode === 'visual' ? 'Edit HTML source' : 'Return to canvas'}>
                    {mode === 'visual' ? <Code2 size={14} strokeWidth={1.8} aria-hidden="true" /> : <Eye size={14} strokeWidth={1.8} aria-hidden="true" />}
                  </button>
                )}
              </div>
              <div className="vhe-inspector__tool-group vhe-inspector__tool-group--history">
                <button type="button" className="vhe-tool-button" disabled={!snapshot.canUndo && !textHistoryState.canUndo} onPointerDown={(event) => { if (activeRichTextEditRef.current) event.preventDefault(); }} onClick={() => runHistory('undo')} aria-label="Undo" title="Undo · Ctrl/Cmd+Z"><Undo2 size={15} strokeWidth={1.8} aria-hidden="true" /></button>
                <button type="button" className="vhe-tool-button" disabled={!snapshot.canRedo && !textHistoryState.canRedo} onPointerDown={(event) => { if (activeRichTextEditRef.current) event.preventDefault(); }} onClick={() => runHistory('redo')} aria-label="Redo" title="Redo · Ctrl/Cmd+Shift+Z"><Redo2 size={15} strokeWidth={1.8} aria-hidden="true" /></button>
              </div>
            </div>
          </div>
          {!selectedNode ? (
            <div className="vhe-empty"><div className="vhe-empty__illustration" aria-hidden="true"><i /><i /><i /><MousePointer2 size={27} strokeWidth={1.5} /></div><strong>A little change starts here.</strong><p>Select an element on the canvas to make it yours.</p><div className="vhe-empty__tips"><span><MousePointer2 size={13} aria-hidden="true" /> Click text to edit in place</span><span><Code2 size={13} aria-hidden="true" /> Choose a layer for precise control</span><span><kbd>Alt</kbd> + click to select nested layers</span></div></div>
          ) : (
            <InspectorBody
              selectedNode={selectedNode} profile={snapshot.profile} revision={snapshot.revision}
              propertyDrafts={propertyDrafts} computedStyleValues={computedStyleValues}
              renderedStyleDifferences={renderedStyleDifferences}
              expandedBoxControl={expandedBoxControl} setExpandedBoxControl={setExpandedBoxControl}
              updateStyleDraft={updateStyleDraft} applyStyle={applyStyle} applyAttribute={applyAttribute}
              onReplaceImage={() => imageInputRef.current?.click()}
            />
          )}
        </aside>
      </div>
      <footer className="vhe-status"><span className="vhe-status__save" data-dirty={snapshot.dirty || workspaceDirty}><i />{snapshot.dirty || workspaceDirty ? 'Unsaved changes' : 'Saved checkpoint'}</span><span className="vhe-status__hint">Your canvas. Your source. Your control.</span><span className="vhe-status__validation">{snapshot.issues.length === 0 && <Check size={12} aria-hidden="true" />}{snapshot.issues.length} validation issue{snapshot.issues.length === 1 ? '' : 's'}</span></footer>
    </div>
  );
}
