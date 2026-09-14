import { useCallback, useSyncExternalStore } from 'react';
import type { DeckController, DeckSnapshot } from '@visual-html/deck';

export function useDeckSnapshot(controller: DeckController): DeckSnapshot {
  const subscribe = useCallback((listener: () => void) => controller.subscribe(listener), [controller]);
  const getSnapshot = useCallback(() => controller.getSnapshot(), [controller]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
