import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { emailProfile, slidesProfile, webProfile, type EditorController, type EditorProfile } from '@visual-html/core';
import { HtmlEditor, type HtmlEditorHandle } from '@visual-html/react';
import '@visual-html/react/styles.css';
import './styles.css';

interface LocalDocument { html: string; name: string; profile: string; baseUrl: string }
const profiles: Record<string, EditorProfile> = { email: emailProfile, slides: slidesProfile, web: webProfile };

function LocalEditor() {
  const [document, setDocument] = useState<LocalDocument | null>(null);
  const [html, setHtml] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [status, setStatus] = useState('Loading HTML…');
  const editorRef = useRef<HtmlEditorHandle>(null);
  const controllerRef = useRef<EditorController | null>(null);

  useEffect(() => {
    fetch('/api/document').then(async (response) => {
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<LocalDocument>;
    }).then((loaded) => {
      setDocument(loaded);
      setHtml(loaded.html);
      setStatus('Ready');
    }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Unable to load HTML.'));
  }, []);

  async function save() {
    try {
      setStatus('Saving…');
      const result = await editorRef.current?.flush();
      if (!result) throw new Error('The editor is not ready.');
      const response = await fetch('/api/document', { method: 'PUT', headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: result.html });
      if (!response.ok) throw new Error(await response.text());
      setHtml(result.html);
      controllerRef.current?.createCheckpoint();
      setStatus(`Saved ${document?.name ?? 'HTML'}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save HTML.');
    }
  }

  if (!document) return <main className="local-loading" role="status">{status}</main>;
  return (
    <main className="local-editor">
      <HtmlEditor
        ref={editorRef}
        value={html}
        profile={profiles[document.profile] ?? webProfile}
        baseUrl={document.baseUrl}
        readOnly={readOnly}
        documentTitle={document.name}
        onChange={({ html: nextHtml }) => setHtml(nextHtml)}
        onReady={(controller) => { controllerRef.current = controller; }}
        onError={(error) => setStatus(error.message)}
        toolbarContent={<div className="local-actions"><span role="status">{status}</span><button type="button" className="vhe-button" onClick={() => setReadOnly((current) => !current)}>{readOnly ? 'Edit' : 'Preview'}</button><button type="button" className="vhe-button vhe-button--primary" onClick={save} disabled={readOnly}>Save file</button></div>}
      />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><LocalEditor /></React.StrictMode>);
