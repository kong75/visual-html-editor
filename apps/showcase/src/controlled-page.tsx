import { useRef, useState } from 'react';
import { type EditorController, type ExternalSourceUpdatePolicy, webProfile } from '@visual-html/core';
import { HtmlEditor, type AssetAdapter, type EditorTextSelection, type HtmlEditorChange, type HtmlEditorHandle } from '@visual-html/react';

const initialHtml = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Controlled editor</title></head>
<body style="margin: 0; padding: 64px; color: #202327; background-color: #f4f1e9; font-family: Arial, sans-serif;">
  <main style="max-width: 760px; margin: 0 auto;">
    <p style="color: #6253d8; font-weight: 700; text-transform: uppercase;">Controlled integration</p>
    <h1 style="font-size: 58px; line-height: 1.04;">Generated HTML stays under host control.</h1>
  </main>
</body>
</html>`;

const replacementHtml = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>External update</title></head>
<body style="margin: 0; padding: 64px; color: #173d2b; background-color: #e3f5e9; font-family: Arial, sans-serif;">
  <main><h1 style="font-size: 54px;">External value replaced the document.</h1></main>
</body>
</html>`;

const rejectedHtml = '<!doctype html><html><body><h1>Rejected external value.</h1></body></html>';
const ignoredHtml = '<!doctype html><html><body><h1>Ignored external value.</h1></body></html>';

const controlledAssetAdapter: AssetAdapter = {
  async upload(file) {
    if (file.name === 'upload-fail.png') throw new Error('Upload service unavailable.');
    return { url: 'data:image/png;base64,AAAA', alt: file.name.replace(/\.[^.]+$/, '') };
  }
};

export function ControlledPage() {
  const [html, setHtml] = useState(initialHtml);
  const [changeCount, setChangeCount] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [issueCount, setIssueCount] = useState(0);
  const [selectedTag, setSelectedTag] = useState('none');
  const [textSelection, setTextSelection] = useState('none');
  const [textApiResult, setTextApiResult] = useState('none');
  const [controllerId, setControllerId] = useState('loading');
  const [externalUpdate, setExternalUpdate] = useState<ExternalSourceUpdatePolicy>('replace');
  const [externalResult, setExternalResult] = useState('none');
  const [readOnly, setReadOnly] = useState(false);
  const [flushResult, setFlushResult] = useState('none');
  const controllerRef = useRef<EditorController | null>(null);
  const editorRef = useRef<HtmlEditorHandle>(null);
  const textSelectionRef = useRef<EditorTextSelection | null>(null);

  const handleChange = (change: HtmlEditorChange) => {
    setHtml(change.html);
    setChangeCount((count) => count + 1);
  };

  return (
    <main className="controlled-page">
      <div className="controlled-page__status" aria-label="Controlled editor status">
        <span data-testid="controlled-controller">{controllerId}</span>
        <span data-testid="controlled-changes">{changeCount} changes</span>
        <span data-testid="controlled-dirty">{dirty ? 'dirty' : 'clean'}</span>
        <span data-testid="controlled-issues">{issueCount} issues</span>
        <span data-testid="controlled-selection">{selectedTag}</span>
        <span data-testid="controlled-text-selection">{textSelection}</span>
        <span data-testid="controlled-text-api">{textApiResult}</span>
        <span data-testid="controlled-external-result">{externalResult}</span>
        <span data-testid="controlled-flush">{flushResult}</span>
        <button type="button" onClick={() => { setExternalUpdate('replace'); setHtml(replacementHtml); }}>Replace externally</button>
        <button type="button" onClick={() => { setExternalUpdate('reject-when-dirty'); setHtml(rejectedHtml); }}>Reject external while dirty</button>
        <button type="button" onClick={() => { setExternalUpdate('replace-when-clean'); setHtml(ignoredHtml); }}>Ignore external while dirty</button>
        <button type="button" onClick={() => controllerRef.current?.createCheckpoint()}>Create checkpoint</button>
        <button type="button" onClick={() => setReadOnly((current) => !current)}>{readOnly ? 'Enable editing' : 'Enable read-only'}</button>
        <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={async () => {
          const result = await editorRef.current?.flush();
          setFlushResult(result?.html.includes('Flushed inline value') && !result.html.includes('<base') ? 'latest clean value' : `revision ${result?.revision ?? 'none'}`);
        }}>Flush changes</button>
        <button type="button" onClick={async () => {
          const applied = await editorRef.current?.setSelectedTextStyles({ color: '#7c3aed' }, textSelectionRef.current);
          const current = editorRef.current?.getTextSelection();
          setTextApiResult(applied && current ? `${current.range.start}-${current.range.end}` : 'unavailable');
        }}>Style selection through API</button>
      </div>
      <HtmlEditor
        ref={editorRef}
        value={html}
        profile={webProfile}
        baseUrl="http://127.0.0.1:4173/fixtures/"
        readOnly={readOnly}
        externalUpdate={externalUpdate}
        assetAdapter={controlledAssetAdapter}
        documentTitle="Controlled HTML"
        onChange={handleChange}
        onDirtyChange={setDirty}
        onValidationChange={(issues) => setIssueCount(issues.length)}
        onSelectionChange={({ node }) => setSelectedTag(node?.tagName ?? 'none')}
        onTextSelectionChange={(selection) => {
          if (selection) textSelectionRef.current = selection;
          setTextSelection(selection ? `${selection.range.start}-${selection.range.end}` : 'none');
        }}
        onExternalUpdateResult={(result) => {
          setExternalResult(result.ok
            ? result.replaced ? 'replaced' : result.reason ?? 'unchanged'
            : result.code);
        }}
        onReady={(controller) => {
          controllerRef.current = controller;
          setControllerId(controller.id);
        }}
      />
    </main>
  );
}
