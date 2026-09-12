import { useCallback, useRef } from 'react';
import type React from 'react';
import type { EditorController, EditorSnapshot, NodeKey, ParsedNode } from '@visual-html/core';
import type { VisualHtmlEditorProps } from '../editor-types.js';
import { fileToDataUrl, downloadHtml } from './browser-files.js';

interface EditorFilesOptions extends Pick<VisualHtmlEditorProps, 'assetAdapter' | 'onExport' | 'onExportRequest'> {
  controller: EditorController;
  snapshot: EditorSnapshot;
  selectedKey: NodeKey | null;
  selectedNode: ParsedNode | undefined;
  setNotice: (message: string | null) => void;
  run: (operation: Promise<{ ok: boolean; message?: string }>) => Promise<boolean>;
}

export function useEditorFiles({ controller, snapshot, selectedKey, selectedNode, assetAdapter, onExport, onExportRequest, setNotice, run }: EditorFilesOptions) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const handleImage = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice('Please choose an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice('Images must be 10 MB or smaller.');
      return;
    }
    try {
      const asset = assetAdapter
        ? await assetAdapter.upload(file)
        : { url: await fileToDataUrl(file), alt: file.name.replace(/\.[^.]+$/, '') };
      if (selectedNode?.tagName === 'img' && snapshot.profile.capabilities.replaceImages) {
        await run(controller.dispatch({ type: 'replaceImage', nodeKey: selectedNode.key, src: asset.url, alt: asset.alt ?? file.name }));
      } else {
        await run(controller.dispatch({
          type: 'insertImage',
          targetNodeKey: selectedKey ?? undefined,
          src: asset.url,
          alt: asset.alt ?? file.name
        }));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Image upload failed.');
    }
  }, [assetAdapter, controller, run, selectedKey, selectedNode, snapshot.profile.capabilities.replaceImages]);

  const exportHtml = useCallback(async () => {
    try {
      const result = await controller.export();
      const blocking = result.issues.filter((issue) => issue.severity === 'blocking');
      if (blocking.length > 0) {
        setNotice(`Export blocked by ${blocking.length} policy issue${blocking.length === 1 ? '' : 's'}.`);
        return;
      }
      if (onExportRequest) {
        await onExportRequest();
        return;
      }
      onExport?.(result.html);
      downloadHtml(result.html, `visual-html-${snapshot.profile.id}.html`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'HTML export failed.');
    }
  }, [controller, onExport, onExportRequest, snapshot.profile.id]);

  return { imageInputRef, handleImage, exportHtml };
}
