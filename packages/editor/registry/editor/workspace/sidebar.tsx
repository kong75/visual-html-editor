import React from 'react';
import type { EditorSnapshot, ParsedNode } from '@visual-html/core';
import { Code2, MousePointer2 } from 'lucide-react';
import { resolveElementBehavior, type ElementBehaviorResolver } from '../element-behavior.js';
import { InspectorBody } from '../inspector/body.js';
import type { useEditorOutline } from '../outline/use-outline.js';
import type { useInspectorProperties } from '../inspector/use-properties.js';

interface EditorSidebarProps {
  snapshot: EditorSnapshot;
  selectedNode: ParsedNode | undefined;
  outline: ReturnType<typeof useEditorOutline>;
  inspector: ReturnType<typeof useInspectorProperties>;
  elementBehaviorResolvers: readonly ElementBehaviorResolver[];
  sidebarHeader?: React.ReactNode;
  onImage: () => void;
  readOnly: boolean;
}

export function EditorSidebar({ snapshot, selectedNode, outline, inspector, elementBehaviorResolvers, sidebarHeader, onImage, readOnly }: EditorSidebarProps) {
  const { outlineNodes } = outline;
  const { propertyDrafts, computedStyleValues, expandedBoxControl, setExpandedBoxControl, updateStyleDraft, applyStyle, applyAttribute } = inspector;
  const inspectorTitle = selectedNode
    ? resolveElementBehavior(selectedNode, outlineNodes, elementBehaviorResolvers).kind
    : 'Properties';

  return (
    <aside className="vhe-inspector">
      {sidebarHeader && <div className="vhe-inspector__context">{sidebarHeader}</div>}
      <div className="vhe-inspector__title">
        <div className="vhe-inspector__title-copy"><span>{inspectorTitle}</span>{selectedNode && <code>{selectedNode.tagName}</code>}</div>
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
