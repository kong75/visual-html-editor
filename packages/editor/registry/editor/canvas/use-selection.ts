import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorController, NodeKey } from '@visual-html/core';
import type { EditorSelectionChange } from '../editor-types.js';
import { queryRuntimeElement, syncRuntimeSelection } from './selection.js';

export interface OverlayRect { left: number; top: number; width: number; height: number }

export function useCanvasSelection(controller: EditorController, revision: number, onSelectionChange?: (selection: EditorSelectionChange) => void) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const selectedKeyRef = useRef<NodeKey | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLButtonElement>(null);
  const overlayFrameRef = useRef<number | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const [selectedKey, setSelectedKey] = useState<NodeKey | null>(null);
  const [overlay, setOverlay] = useState<OverlayRect | null>(null);
  selectedKeyRef.current = selectedKey;
  onSelectionChangeRef.current = onSelectionChange;
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
  }, [controller, syncOverlay, updateOverlay]);

  useEffect(() => { selectNode(null); }, [controller, selectNode]);
  useEffect(() => {
    if (selectedKey && !controller.getNode(selectedKey)) {
      selectNode(null);
      return;
    }
  }, [controller, selectNode, selectedKey, revision]);

  useEffect(() => {
    const handleResize = () => syncOverlay();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (overlayFrameRef.current !== null) cancelAnimationFrame(overlayFrameRef.current);
      overlayFrameRef.current = null;
    };
  }, [syncOverlay]);

  const runtime = useMemo(() => ({ iframeRef, selectedKeyRef, overlayRef, resizeHandleRef, selectNode, updateOverlay, syncOverlay }), [selectNode, updateOverlay, syncOverlay]);
  return { selectedKey, overlay, runtime };
}
