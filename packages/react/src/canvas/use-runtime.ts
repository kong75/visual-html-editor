import { useEffect } from 'react';
import type { CanvasRuntimeContext } from './runtime-types.js';
import { writeCanvasDocument } from './document.js';
import { createCanvasRichText } from './rich-text.js';
import { createCanvasPointer } from './pointer.js';
import { createCanvasKeyboard } from './keyboard.js';
import { syncRuntimeSelection } from './selection.js';

interface CanvasRuntimeOptions extends Omit<CanvasRuntimeContext, 'frame' | 'doc' | 'attrs'> {
  mode: 'visual' | 'source';
  refreshPropertyDrafts: () => void;
}

export function useCanvasRuntime({ controller, snapshot, outlineNodes, elementBehaviorResolversRef, selection, textEditing, setNotice, mode, refreshPropertyDrafts }: CanvasRuntimeOptions) {
  useEffect(() => {
    const frame = selection.iframeRef.current;
    if (!frame || mode !== 'visual') return;
    const documentState = writeCanvasDocument(frame, controller, snapshot);
    if (!documentState) return;
    const { doc } = documentState;
    const context = { frame, ...documentState, controller, snapshot, outlineNodes, elementBehaviorResolversRef, selection, textEditing, setNotice };
    syncRuntimeSelection(frame, selection.selectedKeyRef.current);
    const text = createCanvasRichText(context);
    const pointer = createCanvasPointer(context, text.beginInlineEdit);
    const keyboard = createCanvasKeyboard(context);
    const geometry = () => selection.syncOverlay();
    const listeners: Array<() => void> = [];
    function listen<K extends keyof DocumentEventMap>(name: K, handler: (event: DocumentEventMap[K]) => void, capture = true) {
      doc.addEventListener(name, handler, capture);
      listeners.push(() => doc.removeEventListener(name, handler, capture));
    }
    listen('pointerdown', pointer.handlePointerDown);
    listen('dragstart', pointer.handleNativeDrag);
    listen('click', pointer.handleClick);
    listen('dblclick', pointer.handleDoubleClick);
    listen('selectionchange', text.handleSelectionChange, false);
    listen('focusout', text.handleFocusOut);
    listen('paste', text.handlePaste);
    listen('beforeinput', text.handleBeforeInput);
    listen('input', text.handleInput);
    listen('compositionstart', text.handleCompositionStart);
    listen('compositionend', text.handleCompositionEnd);
    listen('keydown', keyboard);
    listen('scroll', geometry);

    const Observer = doc.defaultView?.ResizeObserver ?? window.ResizeObserver;
    const observer = Observer && doc.body ? new Observer(geometry) : null;
    if (observer && doc.body) observer.observe(doc.body);
    const refreshFrame = requestAnimationFrame(() => {
      selection.syncOverlay();
      refreshPropertyDrafts();
    });
    return () => {
      cancelAnimationFrame(refreshFrame);
      observer?.disconnect();
      pointer.dispose();
      listeners.forEach((remove) => remove());
    };
  }, [controller, mode, outlineNodes, elementBehaviorResolversRef, selection, textEditing, setNotice, refreshPropertyDrafts, snapshot.profile, snapshot.projection.html, snapshot.projection.runtimeAttribute, snapshot.revision]);
}
