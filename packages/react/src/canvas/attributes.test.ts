/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { RUNTIME_NODE_ATTRIBUTE } from '@visual-html/core';
import { bindRuntimeAttributes, runtimeAttributes, sourceRichTextHtml } from './attributes.js';

describe('document-scoped runtime attributes', () => {
  it('keeps bindings independent for multiple canvas documents', () => {
    const first = document.implementation.createHTMLDocument();
    const second = document.implementation.createHTMLDocument();
    expect(runtimeAttributes(first).node).toBe(RUNTIME_NODE_ATTRIBUTE);
    const attributes = bindRuntimeAttributes(first, 'data-vhe-1-node');
    expect(runtimeAttributes(first)).toBe(attributes);
    expect(runtimeAttributes(second).node).toBe(RUNTIME_NODE_ATTRIBUTE);
    expect(attributes.editing).toBe('data-vhe-1-editing');
    bindRuntimeAttributes(first, 'data-vhe-2-node');
    expect(runtimeAttributes(first).node).toBe('data-vhe-2-node');
  });

  it('strips nested runtime attributes while preserving authored lookalikes and the live DOM', () => {
    const doc = document.implementation.createHTMLDocument();
    const attributes = bindRuntimeAttributes(doc, 'data-vhe-1-node');
    const root = doc.createElement('p');
    root.innerHTML = '<strong data-vhe-node="authored" class="keep">A <em title="B">&amp; B</em></strong>';
    for (const element of root.querySelectorAll('*')) {
      for (const name of Object.values(attributes)) element.setAttribute(name, 'runtime');
    }
    const live = root.innerHTML;

    expect(sourceRichTextHtml(root)).toBe('<strong data-vhe-node="authored" class="keep">A <em title="B">&amp; B</em></strong>');
    expect(root.innerHTML).toBe(live);
  });

  it('preserves text, comments, and line breaks in a region without child elements', () => {
    const root = document.createElement('p');
    root.innerHTML = 'A &lt; B<!-- keep -->\nC';
    expect(sourceRichTextHtml(root)).toBe(root.innerHTML);
  });
});
