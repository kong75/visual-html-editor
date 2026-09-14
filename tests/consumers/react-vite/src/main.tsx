import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { slidesProfile } from '@visual-html/core';
import { HtmlEditor, type HtmlEditorChange } from '@visual-html/react';
import '@visual-html/react/styles.css';

const initialHtml = '<!doctype html><html><body><h1 style="position: absolute; left: 80px; top: 80px;">Generated slide</h1></body></html>';

function App() {
  const [html, setHtml] = useState(initialHtml);
  const handleChange = (change: HtmlEditorChange) => setHtml(change.html);
  return <HtmlEditor value={html} profile={slidesProfile} onChange={handleChange} documentTitle="Generated slide" />;
}

createRoot(document.getElementById('root')!).render(<App />);
