interface Point { path: number[]; offset: number }
interface TextState { html: string; anchor?: Point; focus?: Point }
interface Entry { before: TextState; after: TextState; kind: string; time: number }

function point(root: HTMLElement, node: Node | null, offset: number): Point | undefined {
  if (!node || !root.contains(node)) return;
  const path: number[] = [];
  let current: Node = node;
  while (current !== root) {
    const parent: ParentNode = current.parentNode!;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }
  return { path, offset };
}

function capture(root: HTMLElement): TextState {
  const selection = root.ownerDocument.getSelection();
  return {
    html: root.innerHTML,
    anchor: point(root, selection?.anchorNode ?? null, selection?.anchorOffset ?? 0),
    focus: point(root, selection?.focusNode ?? null, selection?.focusOffset ?? 0)
  };
}

function restore(root: HTMLElement, state: TextState) {
  // Snapshots come from this already-hardened editor DOM, never clipboard HTML.
  root.innerHTML = state.html;
  const resolve = (position?: Point) => {
    let node: Node = root;
    for (const index of position?.path ?? []) {
      const child = node.childNodes[index];
      if (!child) return undefined;
      node = child;
    }
    return position ? { node, offset: Math.min(position.offset, node.nodeType === 3 ? node.textContent!.length : node.childNodes.length) } : undefined;
  };
  const anchor = resolve(state.anchor), focus = resolve(state.focus);
  if (anchor && focus) root.ownerDocument.getSelection()?.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
}

/** Local input history until blur commits the edit as one source transaction. */
export class TextEditHistory {
  private entries: Entry[] = [];
  private cursor = 0;
  private pending?: { state: TextState; kind: string };
  constructor(private readonly element: HTMLElement) {}

  get canUndo() { return this.cursor > 0; }
  get canRedo() { return this.cursor < this.entries.length; }

  before(kind: string) {
    this.pending ??= { state: capture(this.element), kind };
  }

  after() {
    const pending = this.pending;
    this.pending = undefined;
    if (!pending) return;
    const after = capture(this.element);
    if (pending.state.html === after.html) return;
    const previous = this.cursor === this.entries.length ? this.entries.at(-1) : undefined;
    const time = Date.now();
    const samePoint = (a?: Point, b?: Point) => JSON.stringify(a) === JSON.stringify(b);
    const continuous = previous && previous.kind === pending.kind && time - previous.time < 1000
      && ['insertText', 'deleteContentBackward', 'deleteContentForward'].includes(pending.kind)
      && previous.after.html === pending.state.html
      && samePoint(previous.after.anchor, pending.state.anchor) && samePoint(previous.after.focus, pending.state.focus)
      && samePoint(pending.state.anchor, pending.state.focus);
    if (continuous) {
      previous.after = after;
      previous.time = time;
    } else {
      this.entries = this.entries.slice(0, this.cursor);
      this.entries.push({ before: pending.state, after, kind: pending.kind, time });
      this.cursor = this.entries.length;
    }
  }

  undo(): boolean {
    this.after();
    if (!this.canUndo) return false;
    const entry = this.entries[--this.cursor];
    entry.time = 0;
    restore(this.element, entry.before);
    return true;
  }

  redo(): boolean {
    if (!this.canRedo) return false;
    const entry = this.entries[this.cursor++];
    entry.time = 0;
    restore(this.element, entry.after);
    return true;
  }
}
