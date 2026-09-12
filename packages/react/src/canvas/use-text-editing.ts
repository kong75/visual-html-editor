import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { EditorController, NodeKey, ParsedNode, InlineMark } from '@visual-html/core';
import type { ElementBehaviorResolver } from '../element-behavior.js';
import { pointTextOffset, queryRuntimeElement, restoreRichTextSelection, readRichTextSelection, type RichTextSelectionState } from './selection.js';
import { runtimeAttributes, sourceRichTextHtml } from './attributes.js';
import { TextEditHistory } from './text-edit-history.js';

interface ActiveRichTextEdit { element: HTMLElement; nodeKey: NodeKey; originalHtml: string; originalDomHtml: string; history: TextEditHistory }
interface TextEditingOptions {
  controller: EditorController;
  revision: number;
  mode: 'visual' | 'source';
  iframeRef: RefObject<HTMLIFrameElement | null>;
  outlineNodes: Map<NodeKey, ParsedNode>;
  elementBehaviorResolversRef: RefObject<readonly ElementBehaviorResolver[]>;
  selectNode: (key: NodeKey | null) => void;
  setNotice: (message: string | null) => void;
  run: (operation: Promise<{ ok: boolean; message?: string }>) => Promise<boolean>;
}

export function useTextEditing({ controller, revision, mode, iframeRef, outlineNodes, elementBehaviorResolversRef, selectNode, setNotice, run }: TextEditingOptions) {
  const richTextSelectionRef = useRef<RichTextSelectionState | null>(null);
  const pendingRichTextSelectionRef = useRef<(RichTextSelectionState & { sourceStart?: number }) | null>(null);
  const activeRichTextEditRef = useRef<ActiveRichTextEdit | null>(null);
  const [textHistoryState, setTextHistoryState] = useState({ canUndo: false, canRedo: false });
  const [richTextSelection, setRichTextSelection] = useState<RichTextSelectionState | null>(null);
  richTextSelectionRef.current = richTextSelection;
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
  }, [controller, setNotice]);

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
  }, [commitActiveRichTextEdit, controller, run, setNotice]);

  useEffect(() => {
    activeRichTextEditRef.current = null;
    pendingRichTextSelectionRef.current = null;
    setTextHistoryState({ canUndo: false, canRedo: false });
    setRichTextSelection(null);
  }, [controller]);
  useEffect(() => {
    const pending = pendingRichTextSelectionRef.current;
    if (!pending || mode !== 'visual') return;
    pendingRichTextSelectionRef.current = null;
    const restorePendingSelection = () => {
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
    };
    // Track both frames so switching modes or controllers cancels pending restoration.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(restorePendingSelection);
    });
    return () => cancelAnimationFrame(frame);
  }, [controller, mode, outlineNodes, refreshTextHistory, selectNode, revision]);

  const runtime = useMemo(() => ({ activeRichTextEditRef, richTextSelectionRef, setRichTextSelection, commitActiveRichTextEdit, refreshTextHistory, runHistory, toggleInlineMark }), [commitActiveRichTextEdit, refreshTextHistory, runHistory, toggleInlineMark]);
  return { richTextSelection, textHistoryState, runtime };
}
