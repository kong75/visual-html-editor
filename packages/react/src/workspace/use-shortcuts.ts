import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { EditorController, EditorCapabilities, NodeKey } from '@visual-html/core';

interface EditorShortcutOptions {
  controller: EditorController;
  mode: 'visual' | 'source';
  pendingHtmlImport: unknown;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  selectedKey: NodeKey | null;
  capabilities: EditorCapabilities;
  run: (operation: Promise<{ ok: boolean; message?: string }>) => Promise<boolean>;
  runHistory: (direction: 'undo' | 'redo') => Promise<boolean>;
}

export function useEditorShortcuts({ controller, mode, pendingHtmlImport, iframeRef, selectedKey, capabilities, run, runHistory }: EditorShortcutOptions) {
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (mode !== 'visual' || pendingHtmlImport || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const editorRoot = iframeRef.current?.closest('.vhe-root');
      if (target && editorRoot?.contains(target) && !target.closest('input, textarea, select, [contenteditable="true"]') && (event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        void runHistory(event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo');
        return;
      }
      if (!selectedKey || !target?.closest('.vhe-outline') || target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && capabilities.duplicateElements) {
        event.preventDefault();
        void run(controller.dispatch({ type: 'duplicateNode', nodeKey: selectedKey }));
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && capabilities.deleteElements) {
        event.preventDefault();
        void run(controller.dispatch({ type: 'removeNode', nodeKey: selectedKey }));
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [controller, mode, pendingHtmlImport, run, runHistory, selectedKey, capabilities.deleteElements, capabilities.duplicateElements]);

}
