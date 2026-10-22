import type { RefObject } from 'react';
import type { EditorController, EditorSnapshot, InlineMark, InlineTextStyleProperty, NodeKey, ParsedNode } from '@visual-html/core';
import type { ElementBehaviorResolver } from '../element-behavior.js';
import type { runtimeAttributes } from './attributes.js';
import type { RichTextSelectionState } from './selection.js';
import type { TextEditHistory } from './text-edit-history.js';

export interface OverlayRect { left: number; top: number; width: number; height: number }

export interface CanvasSelectionRuntime {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  selectedKeyRef: RefObject<NodeKey | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
  resizeHandleRef: RefObject<HTMLButtonElement | null>;
  selectNode(key: NodeKey | null): void;
  updateOverlay(persist?: boolean): void;
  syncOverlay(): void;
}

export interface ActiveRichTextEdit {
  element: HTMLElement;
  nodeKey: NodeKey;
  originalHtml: string;
  originalDomHtml: string;
  history: TextEditHistory;
}

export interface TextEditingRuntime {
  // DOM handlers also replace the session; React 18's RefObject is read-only.
  activeRichTextEditRef: { current: ActiveRichTextEdit | null };
  richTextSelectionRef: RefObject<RichTextSelectionState | null>;
  setRichTextSelection(selection: RichTextSelectionState | null): void;
  commitActiveRichTextEdit(nodeKey?: NodeKey): Promise<boolean>;
  refreshTextHistory(): void;
  runHistory(direction: 'undo' | 'redo'): Promise<boolean>;
  toggleInlineMark(mark: InlineMark, selection?: RichTextSelectionState | null): Promise<boolean>;
  setInlineStyles(styles: Readonly<Partial<Record<InlineTextStyleProperty, string>>>, selection?: RichTextSelectionState | null): Promise<boolean>;
  setBlockAlignment(value: 'left' | 'center' | 'right' | 'justify', selection?: RichTextSelectionState | null): Promise<boolean>;
}

export type BeginInlineEdit = (
  element: HTMLElement, key: NodeKey, node: ParsedNode,
  clientX?: number, clientY?: number, reportUnsupported?: boolean
) => boolean;

// One mounted iframe document owns these bindings; dispose them before replacing it.
export interface CanvasRuntimeContext {
  frame: HTMLIFrameElement;
  doc: Document;
  attrs: ReturnType<typeof runtimeAttributes>;
  controller: EditorController;
  snapshot: EditorSnapshot;
  outlineNodes: Map<NodeKey, ParsedNode>;
  elementBehaviorResolversRef: RefObject<readonly ElementBehaviorResolver[]>;
  selection: CanvasSelectionRuntime;
  textEditing: TextEditingRuntime;
  setNotice: (message: string | null) => void;
}
