import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorController, EditorSnapshot, NodeKey } from '@visual-html/core';
import type { ElementBehaviorResolver } from '../element-behavior.js';
import type { useCanvasSelection } from '../canvas/use-selection.js';
import { outlineHiddenTags, visibleOutlineNodes, initialCollapsedOutlineKeys } from './component-outline.js';
import { queryRuntimeElement } from '../canvas/selection.js';

interface EditorOutlineOptions {
  controller: EditorController;
  snapshot: EditorSnapshot;
  selectedKey: NodeKey | null;
  selection: ReturnType<typeof useCanvasSelection>['runtime'];
  elementBehaviorResolvers: readonly ElementBehaviorResolver[];
  setMode: (mode: 'visual' | 'source') => void;
}

export function useEditorOutline({ controller, snapshot, selectedKey, selection, elementBehaviorResolvers, setMode }: EditorOutlineOptions) {
  const { iframeRef, selectNode, updateOverlay } = selection;
  const [collapsedOutlineKeys, setCollapsedOutlineKeys] = useState<Set<NodeKey>>(() => initialCollapsedOutlineKeys(snapshot.nodes, elementBehaviorResolvers));
  const elementBehaviorResolversRef = useRef(elementBehaviorResolvers);
  elementBehaviorResolversRef.current = elementBehaviorResolvers;
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
    setCollapsedOutlineKeys(initialCollapsedOutlineKeys(controller.getSnapshot().nodes, elementBehaviorResolversRef.current));
  }, [controller]);
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

  return { outlineNodes, outlineRoots, outlineNodeCount, collapsedOutlineKeys, elementBehaviorResolversRef, selectOutlineNode, toggleOutlineNode };
}
