import { useCallback, useSyncExternalStore } from 'react';
import type { EditorController, EditorSnapshot } from '@visual-html/core';

export function useEditorSnapshot(controller: EditorController): EditorSnapshot {
  const subscribe = useCallback((listener: () => void) => controller.subscribe(listener), [controller]);
  const getSnapshot = useCallback(() => controller.getSnapshot(), [controller]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
