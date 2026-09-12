import { readRichTextSelection } from './selection.js';

import type { CanvasRuntimeContext } from './runtime-types.js';

export function createCanvasKeyboard(context: CanvasRuntimeContext) {
  const { controller, snapshot, doc, attrs, outlineNodes, elementBehaviorResolversRef, setNotice } = context;
  const { selectedKeyRef } = context.selection;
  const { richTextSelectionRef, runHistory, toggleInlineMark } = context.textEditing;

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

  return handleKeyDown;
}
