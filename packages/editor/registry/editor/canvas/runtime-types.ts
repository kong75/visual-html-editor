import type { RefObject } from 'react';
import type { EditorController, EditorSnapshot, NodeKey, ParsedNode } from '@visual-html/core';
import type { ElementBehaviorResolver } from '../element-behavior.js';
import type { runtimeAttributes } from './attributes.js';
import type { useCanvasSelection } from './use-selection.js';
import type { useTextEditing } from './use-text-editing.js';

// One mounted iframe document owns these bindings; dispose them before replacing it.
export interface CanvasRuntimeContext {
  frame: HTMLIFrameElement;
  doc: Document;
  attrs: ReturnType<typeof runtimeAttributes>;
  controller: EditorController;
  snapshot: EditorSnapshot;
  outlineNodes: Map<NodeKey, ParsedNode>;
  elementBehaviorResolversRef: RefObject<readonly ElementBehaviorResolver[]>;
  selection: ReturnType<typeof useCanvasSelection>['runtime'];
  textEditing: ReturnType<typeof useTextEditing>['runtime'];
  setNotice: (message: string | null) => void;
}
