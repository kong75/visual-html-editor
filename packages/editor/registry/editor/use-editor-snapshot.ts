import { useEffect, useState } from 'react';
import type { EditorController, EditorSnapshot } from '@visual-html/core';

export function useEditorSnapshot(controller: EditorController): EditorSnapshot {
  const [snapshot, setSnapshot] = useState(() => controller.getSnapshot());

  useEffect(() => {
    setSnapshot(controller.getSnapshot());
    return controller.subscribe(() => setSnapshot(controller.getSnapshot()));
  }, [controller]);

  return snapshot;
}
