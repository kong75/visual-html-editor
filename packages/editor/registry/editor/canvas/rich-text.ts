import type { NodeKey, ParsedNode } from '@visual-html/core';
import { isRichTextRegion, resolveEditingRegion, readRichTextSelection, replaceSelectionWithText } from './selection.js';
import { sourceRichTextHtml } from './attributes.js';
import { TextEditHistory } from './text-edit-history.js';

import type { CanvasRuntimeContext } from './runtime-types.js';

export function createCanvasRichText(context: CanvasRuntimeContext) {
  const { controller, snapshot, doc, attrs, outlineNodes, elementBehaviorResolversRef, setNotice } = context;
  const { selectedKeyRef, selectNode, syncOverlay } = context.selection;
  const { activeRichTextEditRef, setRichTextSelection, commitActiveRichTextEdit, refreshTextHistory, runHistory, toggleInlineMark } = context.textEditing;

  const beginInlineEdit = (
    candidateElement: HTMLElement,
    candidateKey: NodeKey,
    candidateNode: ParsedNode,
    clientX?: number,
    clientY?: number,
    reportUnsupported = false
  ): boolean => {
    if (!snapshot.profile.capabilities.editText) return false;
    const region = resolveEditingRegion(candidateElement, candidateKey, candidateNode, controller, outlineNodes, elementBehaviorResolversRef.current ?? []);
    const editable = region.element;
    const key = region.key;
    const node = region.node;
    const richRegion = node.hasElementChildren && isRichTextRegion(node, controller);
    if ((node.hasElementChildren && !richRegion) || !node.innerRange) {
      if (reportUnsupported) setNotice('This element contains nested structural content. Select a child text layer, or edit the HTML in Source.');
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

  const handleSelectionChange = () => {
    const next = readRichTextSelection(doc, controller, outlineNodes, elementBehaviorResolversRef.current ?? []);
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
    const markForInputType = ({
      formatBold: 'strong', formatItalic: 'em', formatUnderline: 'u', formatStrikeThrough: 's'
    } as const)[event.inputType as 'formatBold' | 'formatItalic' | 'formatUnderline' | 'formatStrikeThrough'];
    if (!markForInputType) activeRichTextEditRef.current?.history.before(event.inputType);
    if (!event.isComposing && ['insertParagraph', 'insertLineBreak'].includes(event.inputType)) {
      event.preventDefault();
      replaceSelectionWithText(doc, '\n');
      handleInput();
      return;
    }
    if (markForInputType) {
      event.preventDefault();
      const selection = readRichTextSelection(doc, controller, outlineNodes, elementBehaviorResolversRef.current ?? []);
      if (selection) void toggleInlineMark(markForInputType, selection);
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

  return { beginInlineEdit, handleSelectionChange, handleFocusOut, handlePaste, handleBeforeInput, handleInput, handleCompositionStart, handleCompositionEnd };
}
