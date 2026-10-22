/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorController, webProfile } from '@visual-html/core';
import { sourceRichTextHtml } from './attributes.js';
import { writeCanvasDocument } from './document.js';
import {
  cycleHitCandidate, isRichTextRegion, pointTextOffset, queryRuntimeElement,
  readRichTextSelection, replaceSelectionWithText, resolveEditingRegion,
  restoreRichTextSelection, runtimeHitCandidates, runtimePointerPoint, syncRuntimeSelection
} from './selection.js';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

async function canvas(html: string) {
  const controller = await EditorController.create({ html, profile: webProfile });
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const { doc, attrs } = writeCanvasDocument(frame, controller, controller.getSnapshot())!;
  const nodes = new Map(controller.getSnapshot().nodes.map((node) => [node.key, node]));
  const element = (id: string) => doc.getElementById(id)!;
  const node = (id: string) => controller.getNode(element(id).getAttribute(attrs.node)!)!;
  return { controller, frame, doc, attrs, nodes, element, node };
}

describe('source-backed editing regions', () => {
  it('distinguishes mixed text from structural and single-child layout wrappers', async () => {
    const { controller, node } = await canvas('<section id="layout"><p id="text">Hello <strong>world</strong></p></section><div id="wrapper"><span>Only text</span></div><table id="table"><tr><td>Cell</td></tr></table>');
    expect(isRichTextRegion(node('text'), controller)).toBe(true);
    expect(isRichTextRegion(node('layout'), controller)).toBe(false);
    expect(isRichTextRegion(node('wrapper'), controller)).toBe(false);
    expect(isRichTextRegion(node('table'), controller)).toBe(false);
  });

  it('promotes formatting wrappers while keeping links and host overrides atomic', async () => {
    const { controller, element, node, nodes } = await canvas('<p id="text">Hello <strong id="format">world</strong> <a id="link" href="#next">Next</a></p>');
    const region = (id: string) => resolveEditingRegion(element(id), node(id).key, node(id), controller, nodes, []);
    expect(region('format').key).toBe(node('text').key);
    expect(region('link').key).toBe(node('link').key);
    expect(resolveEditingRegion(element('format'), node('format').key, node('format'), controller, nodes,
      [() => ({ editTarget: 'self' })]).key).toBe(node('format').key);
  });
});

describe('text selection mapping', () => {
  it('maps text and element boundaries across nested text, entities, and emoji', async () => {
    const { doc, element } = await canvas('<p id="text">A &amp; <em>😀B</em> end</p>');
    const root = element('text');
    expect(pointTextOffset(root, root.querySelector('em')!.firstChild!, 2)).toBe(6);
    expect(pointTextOffset(root, root, 2)).toBe(7);
    expect(pointTextOffset(root, doc.createTextNode('outside'), 0)).toBeUndefined();
    expect(restoreRichTextSelection(root, { start: 4, end: 7 })).toBe(true);
    expect(doc.getSelection()?.toString()).toBe('😀B');
    expect(restoreRichTextSelection(root, { start: 7, end: 999 })).toBe(true);
    expect(doc.getSelection()?.toString()).toBe(' end');
  });

  it('reports marks and mixed styles for the exact selected range', async () => {
    const { controller, doc, element, node, nodes } = await canvas('<p id="text" style="color:red"><strong>Hello</strong> <em style="color:blue">world</em></p>');
    restoreRichTextSelection(element('text'), { start: 0, end: 5 });
    expect(readRichTextSelection(doc, controller, nodes, [])).toMatchObject({
      nodeKey: node('text').key,
      range: { start: 0, end: 5 },
      activeMarks: { strong: true, em: false, u: false, s: false },
      activeStyles: { color: 'red' }
    });
    restoreRichTextSelection(element('text'), { start: 0, end: 11 });
    expect(readRichTextSelection(doc, controller, nodes, [])).toMatchObject({
      range: { start: 0, end: 11 }, activeMarks: { strong: false, em: false }, activeStyles: { color: null }
    });
  });

  it('rejects collapsed and cross-region selections', async () => {
    const { controller, doc, element, nodes } = await canvas('<p id="first">First</p><p id="second">Second</p><p id="empty"></p>');
    expect(readRichTextSelection(doc, controller, nodes, [])).toBeNull();
    restoreRichTextSelection(element('first'), { start: 1, end: 1 });
    expect(readRichTextSelection(doc, controller, nodes, [])).toBeNull();
    doc.getSelection()!.setBaseAndExtent(element('first').firstChild!, 1, element('second').firstChild!, 2);
    expect(readRichTextSelection(doc, controller, nodes, [])).toBeNull();
    expect(restoreRichTextSelection(element('empty'), { start: 0, end: 0 })).toBe(false);
  });

  it('inserts plain clipboard text with normalized line breaks and a collapsed caret', async () => {
    const { doc, element } = await canvas('<p id="text">Hello world!</p>');
    const root = element('text');
    restoreRichTextSelection(root, { start: 6, end: 11 });
    expect(replaceSelectionWithText(doc, '<b>X</b>\r\nnext\rline')).toBe(true);
    expect(sourceRichTextHtml(root)).toBe('Hello &lt;b&gt;X&lt;/b&gt;<br>next<br>line!');
    expect(root.querySelector('b')).toBeNull();
    expect(doc.getSelection()?.isCollapsed).toBe(true);
    const selection = doc.getSelection()!;
    expect(pointTextOffset(root, selection.anchorNode!, selection.anchorOffset)).toBe('Hello <b>X</b>nextline'.length);
  });

  it('supports deletion and declines clipboard operations without a selection', async () => {
    const { doc, element } = await canvas('<p id="text">Hello world</p>');
    expect(replaceSelectionWithText(doc, 'ignored')).toBe(false);
    restoreRichTextSelection(element('text'), { start: 5, end: 11 });
    expect(replaceSelectionWithText(doc, '')).toBe(true);
    expect(element('text').textContent).toBe('Hello');
    expect(doc.getSelection()?.isCollapsed).toBe(true);
  });
});

describe('canvas selection and hit testing', () => {
  it('updates exactly one selected marker and clears it on deselection', async () => {
    const { frame, attrs, element, node } = await canvas('<p id="first">First</p><p id="second">Second</p>');
    syncRuntimeSelection(frame, node('first').key);
    syncRuntimeSelection(frame, node('second').key);
    expect(element('first').hasAttribute(attrs.selected)).toBe(false);
    expect(element('second').getAttribute(attrs.selected)).toBe('true');
    expect(queryRuntimeElement(frame, node('second').key)).toBe(element('second'));
    expect(queryRuntimeElement(frame, 'missing')).toBeNull();
    syncRuntimeSelection(frame, null);
    expect(element('second').hasAttribute(attrs.selected)).toBe(false);
    expect(queryRuntimeElement(null, null)).toBeNull();
  });

  it('deduplicates hit layers, skips non-HTML hits, and cycles through overlapping nodes', async () => {
    const { controller, doc, element, node } = await canvas('<section id="front"><p id="child">Text</p></section><section id="back">Behind</section>');
    const unmarked = doc.createElement('span');
    element('child').append(unmarked);
    Object.defineProperty(doc, 'elementsFromPoint', { value: vi.fn(() => [
      doc.createElementNS('http://www.w3.org/2000/svg', 'path'), unmarked, element('child'), element('front'), element('back'), doc.body
    ]) });
    const hits = runtimeHitCandidates(doc, controller, 40, 60);
    expect(hits.map((hit) => hit.key)).toEqual([node('child').key, node('front').key, node('back').key]);
    expect(cycleHitCandidate(hits, node('child').key)?.key).toBe(node('front').key);
    expect(cycleHitCandidate(hits, node('back').key)?.key).toBe(node('child').key);
    expect(cycleHitCandidate(hits, 'missing')?.key).toBe(node('child').key);
    expect(cycleHitCandidate([], null)).toBeUndefined();
  });

  it('converts parent coordinates for a scaled frame and respects explicit coordinate spaces', async () => {
    const { frame, doc, element } = await canvas('<p id="text">Text</p>');
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 400, 200));
    Object.defineProperties(doc.defaultView!, { innerWidth: { value: 800 }, innerHeight: { value: 400 } });
    Object.defineProperty(doc, 'elementFromPoint', { value: (x: number, y: number) => x === 400 && y === 200 ? element('text') : null });
    const event = new MouseEvent('click', { clientX: 300, clientY: 150 });
    expect(runtimePointerPoint(frame, doc, event, element('text'))).toEqual({ x: 400, y: 200, space: 'parent' });
    expect(runtimePointerPoint(frame, doc, event, element('text'), 'parent')).toEqual({ x: 400, y: 200, space: 'parent' });
    expect(runtimePointerPoint(frame, doc, event, element('text'), 'document')).toEqual({ x: 300, y: 150, space: 'document' });
  });
});
