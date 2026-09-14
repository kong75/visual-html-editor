import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { webProfile } from '@visual-html/core';
import { HtmlEditor, type HtmlEditorChange } from './components/visual-html-editor';

const initialHtml = '<!doctype html><html><body><h1>Editable source installation</h1></body></html>';

function App() {
  const [html, setHtml] = useState(initialHtml);
  return <HtmlEditor value={html} profile={webProfile} onChange={(change: HtmlEditorChange) => setHtml(change.html)} />;
}

createRoot(document.getElementById('root')!).render(<App />);
