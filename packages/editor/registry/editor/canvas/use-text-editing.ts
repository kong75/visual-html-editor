import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { EditorCommand, EditorController, NodeKey, ParsedNode, InlineMark, InlineTextStyleProperty } from '@visual-html/core';
import type { ElementBehaviorResolver } from '../element-behavior.js';
import type { EditorTextSelection } from '../editor-types.js';
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
  onTextSelectionChange?: (selection: EditorTextSelection | null) => void;
}

export function useTextEditing({ controller, revision, mode, iframeRef, outlineNodes, elementBehaviorResolversRef, selectNode, setNotice, run, onTextSelectionChange }: TextEditingOptions) {
  const richTextSelectionRef = useRef<RichTextSelectionState | null>(null);
  const pendingRichTextSelectionRef = useRef<(RichTextSelectionState & { sourceStart?: number }) | null>(null);
  const activeRichTextEditRef = useRef<ActiveRichTextEdit | null>(null);
  const onTextSelectionChangeRef = useRef(onTextSelectionChange);
  const [textHistoryState, setTextHistoryState] = useState({ canUndo: false, canRedo: false });
  const [richTextSelection, setRichTextSelection] = useState<RichTextSelectionState | null>(null);
  onTextSelectionChangeRef.current = onTextSelectionChange;
  const updateRichTextSelection = useCallback((selection: RichTextSelectionState | null) => {
    richTextSelectionRef.current = selection;
    setRichTextSelection(selection);
    onTextSelectionChangeRef.current?.(selection);
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
        activeMarks: { strong: false, em: false, u: false, s: false },
        activeStyles: {
          'font-family': null, 'font-size': null, 'font-weight': null,
          color: null, 'line-height': null, 'letter-spacing': null
        }
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

  const runSelectionCommand = useCallback(async (
    selection: RichTextSelectionState,
    command: EditorCommand
  ) => {
    if (!await commitActiveRichTextEdit(selection.nodeKey)) return false;
    const rootStart = controller.getNode(selection.nodeKey)?.range?.start;
    pendingRichTextSelectionRef.current = { ...selection, sourceStart: rootStart };
    const success = await run(controller.dispatch(command));
    if (!success) pendingRichTextSelectionRef.current = null;
    else if (rootStart !== undefined && !controller.getNode(selection.nodeKey)) {
      const root = controller.getSnapshot().nodes.find((node) => !node.virtual && node.range?.start === rootStart);
      if (root) pendingRichTextSelectionRef.current = { ...selection, nodeKey: root.key };
    }
    return success;
  }, [commitActiveRichTextEdit, controller, run]);

  const toggleInlineMark = useCallback(async (mark: InlineMark, selection = richTextSelectionRef.current) => {
    if (!selection) {
      setNotice('Select some text before applying formatting.');
      return false;
    }
    return runSelectionCommand(selection, {
      type: 'toggleInlineMark',
      nodeKey: selection.nodeKey,
      range: selection.range,
      mark
    });
  }, [runSelectionCommand, setNotice]);

  const setInlineStyles = useCallback(async (
    styles: Readonly<Partial<Record<InlineTextStyleProperty, string>>>,
    selection = richTextSelectionRef.current
  ) => {
    if (!selection) {
      setNotice('Select some text before applying formatting.');
      return false;
    }
    for (const [property, value] of Object.entries(styles)) {
      if (value && !CSS.supports(property, value.replace(/\s*!important\s*$/i, ''))) {
        setNotice(`“${value}” is not valid for ${property}. The selected text is unchanged.`);
        return false;
      }
    }
    return runSelectionCommand(selection, {
      type: 'setInlineStyles',
      nodeKey: selection.nodeKey,
      range: selection.range,
      styles
    });
  }, [runSelectionCommand, setNotice]);

  const setBlockAlignment = useCallback(async (
    value: 'left' | 'center' | 'right' | 'justify',
    selection = richTextSelectionRef.current
  ) => {
    if (!selection) {
      setNotice('Select some text before changing alignment.');
      return false;
    }
    return runSelectionCommand(selection, {
      type: 'setStyle', nodeKey: selection.nodeKey, property: 'text-align', value
    });
  }, [runSelectionCommand, setNotice]);

  useEffect(() => {
    activeRichTextEditRef.current = null;
    pendingRichTextSelectionRef.current = null;
    setTextHistoryState({ canUndo: false, canRedo: false });
    updateRichTextSelection(null);
  }, [controller, updateRichTextSelection]);
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
      updateRichTextSelection(next);
      selectNode(node.key);
    };
    // Track both frames so switching modes or controllers cancels pending restoration.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(restorePendingSelection);
    });
    return () => cancelAnimationFrame(frame);
  }, [controller, mode, outlineNodes, refreshTextHistory, selectNode, revision, updateRichTextSelection]);

  const runtime = useMemo(() => ({
    activeRichTextEditRef, richTextSelectionRef, setRichTextSelection: updateRichTextSelection,
    commitActiveRichTextEdit, refreshTextHistory, runHistory,
    toggleInlineMark, setInlineStyles, setBlockAlignment
  }), [commitActiveRichTextEdit, refreshTextHistory, runHistory, setBlockAlignment, setInlineStyles, toggleInlineMark, updateRichTextSelection]);
  return { richTextSelection, textHistoryState, runtime };
}
