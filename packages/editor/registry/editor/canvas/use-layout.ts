import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { EditorController, EditorSnapshot, NodeKey } from '@visual-html/core';
import type { useCanvasSelection } from './use-selection.js';
import { queryRuntimeElement } from './selection.js';
import { layoutDeltaMapper, layoutSize } from './geometry.js';

interface CanvasLayoutOptions {
  controller: EditorController;
  snapshot: EditorSnapshot;
  mode: 'visual' | 'source';
  selectedKey: NodeKey | null;
  selection: ReturnType<typeof useCanvasSelection>['runtime'];
  run: (operation: Promise<{ ok: boolean; message?: string }>) => Promise<boolean>;
}

export function useCanvasLayout({ controller, snapshot, mode, selectedKey, selection, run }: CanvasLayoutOptions) {
  const { iframeRef, syncOverlay, updateOverlay } = selection;
  const stageViewportRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const [aspectId, setAspectId] = useState(snapshot.profile.defaultAspectRatioId);
  const aspect = useMemo(
    () => snapshot.profile.aspectRatios.find((option) => option.id === aspectId) ?? snapshot.profile.aspectRatios[0],
    [aspectId, snapshot.profile.aspectRatios]
  );

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

  return { stageViewportRef, canvasScale, aspect, setAspectId, startResize };
}
