import { useEffect, useState } from 'react';
import type { DeckController, DeckSnapshot } from '@visual-html/deck';

export function useDeckSnapshot(controller: DeckController): DeckSnapshot {
  const [snapshot, setSnapshot] = useState(() => controller.getSnapshot());

  useEffect(() => {
    setSnapshot(controller.getSnapshot());
    return controller.subscribe(() => setSnapshot(controller.getSnapshot()));
  }, [controller]);

  return snapshot;
}
