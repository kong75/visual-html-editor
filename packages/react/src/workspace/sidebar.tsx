import React from 'react';
import type { EditorSnapshot, NodeKey, ParsedNode } from '@visual-html/core';
import { Code2, Eye, ImagePlus, MousePointer2, Redo2, Undo2 } from 'lucide-react';
import { resolveElementBehavior, type ElementBehaviorResolver } from '../element-behavior.js';
import { ComponentOutlineNode } from '../outline/component-outline.js';
import { InspectorBody } from '../inspector/body.js';
import type { useEditorOutline } from '../outline/use-outline.js';
import type { useTextEditing } from '../canvas/use-text-editing.js';
import type { useInspectorProperties } from '../inspector/use-properties.js';

interface EditorSidebarProps {
  snapshot: EditorSnapshot;
  selectedKey: NodeKey | null;
  selectedNode: ParsedNode | undefined;
  outline: ReturnType<typeof useEditorOutline>;
  textEditing: ReturnType<typeof useTextEditing>;
  inspector: ReturnType<typeof useInspectorProperties>;
  elementBehaviorResolvers: readonly ElementBehaviorResolver[];
  sidebarHeader?: React.ReactNode;
  mode: 'visual' | 'source';
  setMode: (mode: 'visual' | 'source') => void;
  openSource: () => void;
  onImage: () => void;
  readOnly: boolean;
}

export function EditorSidebar({ snapshot, selectedKey, selectedNode, outline, textEditing, inspector, elementBehaviorResolvers, sidebarHeader, mode, setMode, openSource, onImage, readOnly }: EditorSidebarProps) {
  const { outlineNodes, outlineRoots, outlineNodeCount, collapsedOutlineKeys, selectOutlineNode, toggleOutlineNode } = outline;
  const { textHistoryState, runtime: { activeRichTextEditRef, runHistory } } = textEditing;
  const { propertyDrafts, computedStyleValues, expandedBoxControl, setExpandedBoxControl, updateStyleDraft, applyStyle, applyAttribute } = inspector;
  const inspectorTitle = selectedNode
    ? resolveElementBehavior(selectedNode, outlineNodes, elementBehaviorResolvers).kind
    : 'Properties';

  return (
    <aside className="vhe-inspector">
      {sidebarHeader && <div className="vhe-inspector__context">{sidebarHeader}</div>}
      <section className="vhe-outline" aria-label="Layer selector">
        <header className="vhe-outline__header"><strong>Layers</strong><span>{outlineNodeCount}</span></header>
        <div className="vhe-outline__tree" role="tree" aria-label="Document structure">
          {outlineRoots.map((node) => (
            <ComponentOutlineNode
              key={node.key}
              node={node}
              nodes={outlineNodes}
              selectedKey={selectedKey}
              collapsedKeys={collapsedOutlineKeys}
              depth={0}
              behaviorResolvers={elementBehaviorResolvers}
              onSelect={selectOutlineNode}
              onToggle={toggleOutlineNode}
            />
          ))}
        </div>
      </section>
      <div className="vhe-inspector__title">
        <div className="vhe-inspector__title-copy"><span>{inspectorTitle}</span>{selectedNode && <code>{selectedNode.tagName}</code>}</div>
        <div className="vhe-inspector__tools" role="toolbar" aria-label="Editing tools">
          <div className="vhe-inspector__tool-group">
            {snapshot.profile.capabilities.insertImages && <button type="button" className="vhe-tool-button" onClick={onImage} aria-label="Image" title="Insert image"><ImagePlus size={15} strokeWidth={1.8} aria-hidden="true" /></button>}
            {snapshot.profile.capabilities.editSource && (
              <button type="button" className={`vhe-tool-button${mode === 'source' ? ' vhe-tool-button--active' : ''}`} onClick={mode === 'visual' ? openSource : () => setMode('visual')} aria-label={mode === 'visual' ? 'Source' : 'Visual'} title={mode === 'visual' ? 'Edit HTML source' : 'Return to canvas'}>
                {mode === 'visual' ? <Code2 size={14} strokeWidth={1.8} aria-hidden="true" /> : <Eye size={14} strokeWidth={1.8} aria-hidden="true" />}
              </button>
            )}
          </div>
          <div className="vhe-inspector__tool-group vhe-inspector__tool-group--history">
            <button type="button" className="vhe-tool-button" disabled={readOnly || (!snapshot.canUndo && !textHistoryState.canUndo)} onPointerDown={(event) => { if (activeRichTextEditRef.current) event.preventDefault(); }} onClick={() => runHistory('undo')} aria-label="Undo" title="Undo · Ctrl/Cmd+Z"><Undo2 size={15} strokeWidth={1.8} aria-hidden="true" /></button>
            <button type="button" className="vhe-tool-button" disabled={readOnly || (!snapshot.canRedo && !textHistoryState.canRedo)} onPointerDown={(event) => { if (activeRichTextEditRef.current) event.preventDefault(); }} onClick={() => runHistory('redo')} aria-label="Redo" title="Redo · Ctrl/Cmd+Shift+Z"><Redo2 size={15} strokeWidth={1.8} aria-hidden="true" /></button>
          </div>
        </div>
      </div>
      {!selectedNode ? (
        <div className="vhe-empty"><div className="vhe-empty__illustration" aria-hidden="true"><i /><i /><i /><MousePointer2 size={27} strokeWidth={1.5} /></div><strong>{readOnly ? 'Inspect this document.' : 'A little change starts here.'}</strong><p>{readOnly ? 'Select an element to inspect it.' : 'Select an element on the canvas to make it yours.'}</p><div className="vhe-empty__tips"><span><MousePointer2 size={13} aria-hidden="true" /> {readOnly ? 'Click an element to inspect it' : 'Click text to edit in place'}</span><span><Code2 size={13} aria-hidden="true" /> Choose a layer for precise control</span><span><kbd>Alt</kbd> + click to select nested layers</span></div></div>
      ) : (
        <div className="vhe-inspector__body">
          {!readOnly && (
            <InspectorBody
              selectedNode={selectedNode} profile={snapshot.profile} revision={snapshot.revision}
              propertyDrafts={propertyDrafts} computedStyleValues={computedStyleValues}
              expandedBoxControl={expandedBoxControl} setExpandedBoxControl={setExpandedBoxControl}
              updateStyleDraft={updateStyleDraft} applyStyle={applyStyle} applyAttribute={applyAttribute}
              onReplaceImage={onImage}
            />
          )}
        </div>
      )}
    </aside>
  );
}
