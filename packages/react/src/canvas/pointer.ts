import { runtimeHitCandidates, cycleHitCandidate, runtimePointerPoint } from './selection.js';
import { layoutDeltaMapper } from './geometry.js';
import type { createCanvasRichText } from './rich-text.js';

import type { CanvasRuntimeContext } from './runtime-types.js';

type PointerContext = Pick<CanvasRuntimeContext, 'controller' | 'snapshot' | 'doc' | 'attrs' | 'frame' | 'setNotice' | 'selection'>;

export function createCanvasPointer(context: PointerContext, beginInlineEdit: ReturnType<typeof createCanvasRichText>['beginInlineEdit']) {
  const { controller, snapshot, doc, attrs, frame, setNotice } = context;
  const { selectedKeyRef, overlayRef, resizeHandleRef, selectNode, updateOverlay, syncOverlay } = context.selection;

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
    const { element: editable, key } = dragCandidate;

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

  return {
    handlePointerDown, handleNativeDrag, handleClick, handleDoubleClick,
    dispose() {
      activeDragCleanup?.();
      if (suppressClickTimer !== null) doc.defaultView?.clearTimeout(suppressClickTimer);
    }
  };
}
