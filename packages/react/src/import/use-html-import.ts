import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { EditorController, type EditorProfile } from '@visual-html/core';
import type { HtmlImportAdapter, HtmlImportInput, HtmlImportPreview, HtmlImportResult } from '../editor-types.js';
import { isHtmlFile, formatFileSize } from '../workspace/browser-files.js';

export interface PendingHtmlImport {
  input: HtmlImportInput;
  preview: HtmlImportPreview;
}

interface HtmlImportOptions {
  controller: EditorController;
  profile: EditorProfile;
  dirty: boolean;
  documentTitle: string;
  importAdapter?: HtmlImportAdapter;
  setNotice: (message: string | null) => void;
  onImported: (message: string) => void;
}

const defaultHtmlImportMaxBytes = 5 * 1024 * 1024;

export function useHtmlImport({ controller, profile, dirty, documentTitle, importAdapter, setNotice, onImported }: HtmlImportOptions) {
  const [pendingHtmlImport, setPendingHtmlImport] = useState<PendingHtmlImport | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  useEffect(() => {
    setPendingHtmlImport(null);
    setIsImporting(false);
  }, [controller]);
  const prepareHtmlImport = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!isHtmlFile(file)) {
      setNotice('Choose an .html or .htm file.');
      return;
    }
    const maxBytes = importAdapter?.maxBytes ?? defaultHtmlImportMaxBytes;
    if (file.size > maxBytes) {
      setNotice(`HTML files must be ${formatFileSize(maxBytes)} or smaller.`);
      return;
    }
    if (file.size === 0) {
      setNotice('The selected HTML file is empty.');
      return;
    }

    try {
      const input = { file, html: await file.text() };
      const prepared = importAdapter?.prepare
        ? await importAdapter.prepare(input)
        : await (async (): Promise<HtmlImportPreview> => {
          const candidate = await EditorController.create({ profile, html: input.html });
          const issues = candidate.getSnapshot().issues;
          const blocking = issues.filter((issue) => issue.severity === 'blocking').length;
          return {
            warnings: blocking > 0
              ? [`This file contains ${blocking} policy issue${blocking === 1 ? '' : 's'}. It can be edited, but export will remain blocked until they are resolved.`]
              : []
          };
        })();

      setPendingHtmlImport({
        input,
        preview: {
          ...prepared,
          title: prepared.title ?? `Import ${file.name}`,
          description: prepared.description ?? `Replace ${documentTitle} with this HTML document.`,
          hasUnsavedChanges: prepared.hasUnsavedChanges ?? dirty
        }
      });
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The HTML file could not be prepared for import.');
    }
  }, [documentTitle, importAdapter, dirty, profile, setNotice]);

  const confirmHtmlImport = useCallback(async () => {
    if (!pendingHtmlImport || isImporting) return;
    setIsImporting(true);
    try {
      let result: void | HtmlImportResult = undefined;
      if (importAdapter) {
        result = await importAdapter.apply(pendingHtmlImport.input);
      } else {
        const replacement = await controller.replaceSource(pendingHtmlImport.input.html, {
          policy: 'replace',
          createCheckpoint: false,
          recordHistory: true,
          description: `Import ${pendingHtmlImport.input.file.name}`
        });
        if (!replacement.ok) throw new Error(replacement.message);
      }
      setPendingHtmlImport(null);
      setNotice(null);
      onImported(result?.message ?? `Imported ${pendingHtmlImport.input.file.name}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'HTML import failed.');
    } finally {
      setIsImporting(false);
    }
  }, [controller, importAdapter, isImporting, pendingHtmlImport, onImported, setNotice]);

  const cancelHtmlImport = useCallback(() => { if (!isImporting) setPendingHtmlImport(null); }, [isImporting]);
  return { pendingHtmlImport, isImporting, prepareHtmlImport, confirmHtmlImport, cancelHtmlImport };
}
