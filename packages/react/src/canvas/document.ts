import { hardenRuntimeHtml, type EditorController, type EditorSnapshot } from '@visual-html/core';
import { bindRuntimeAttributes } from './attributes.js';
import { isRichTextRegion } from './selection.js';

export function writeCanvasDocument(frame: HTMLIFrameElement, controller: EditorController, snapshot: EditorSnapshot, baseUrl?: string) {
  const writableDoc = frame.contentDocument;
  if (!writableDoc) return null;
  writableDoc.open();
  writableDoc.write(hardenRuntimeHtml(snapshot.projection.html, { baseUrl }));
  writableDoc.close();

  // WebKit may replace the iframe Document during document.open()/write().
  // Always bind runtime state and events to the live document after writing.
  const doc = frame.contentDocument;
  if (!doc) return null;
  const attrs = bindRuntimeAttributes(doc, snapshot.projection.runtimeAttribute);

  const runtimeStyle = doc.createElement('style');
  runtimeStyle.setAttribute(attrs.runtime, 'true');
  runtimeStyle.textContent = `
    html, body { min-height: 100%; }
    [${attrs.editing}="true"] {
      outline: none !important;
      caret-color: #7652ba;
      cursor: text !important;
    }
    [${attrs.node}][${attrs.interaction}="text"]:not([${attrs.editing}="true"]) { cursor: text; }
    /* Keep empty text blocks reachable without adding content or styles to the source. */
    [${attrs.node}][${attrs.interaction}="text"]:empty:is(p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, div, section, figcaption) {
      min-height: 1em;
    }
    [${attrs.node}][${attrs.interaction}="select"]:not([${attrs.selected}="true"]) { cursor: default; }
    ${snapshot.profile.capabilities.dragElements ? `
      [${attrs.node}] { touch-action: none; }
      [${attrs.node}][${attrs.interaction}="select"][${attrs.selected}="true"] { cursor: move; }
      html[${attrs.dragActive}="true"], html[${attrs.dragActive}="true"] * { cursor: grabbing !important; }
      [${attrs.dragging}="true"] {
        cursor: grabbing !important;
        user-select: none !important;
        translate: var(--vhe-drag-x, 0px) var(--vhe-drag-y, 0px);
        will-change: translate;
      }
    ` : ''}
  `;
  doc.head.append(runtimeStyle);

  for (const element of doc.querySelectorAll<HTMLElement>(`[${attrs.node}]`)) {
    const key = element.getAttribute(attrs.node);
    const node = key ? controller.getNode(key) : undefined;
    const directlyEditable = Boolean(snapshot.profile.capabilities.editText && node?.innerRange && (!node.hasElementChildren || isRichTextRegion(node, controller)));
    element.setAttribute(attrs.interaction, directlyEditable ? 'text' : 'select');
  }

  return { doc, attrs };
}
