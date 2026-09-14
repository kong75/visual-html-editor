import React from 'react';
import type { NodeKey } from '@visual-html/core';
import type { ElementBehaviorResolver } from '../element-behavior.js';
import { ComponentOutlineNode } from '../outline/component-outline.js';
import type { useEditorOutline } from '../outline/use-outline.js';

interface EditorNavigatorProps {
  navigationRail?: React.ReactNode;
  selectedKey: NodeKey | null;
  outline: ReturnType<typeof useEditorOutline>;
  elementBehaviorResolvers: readonly ElementBehaviorResolver[];
}

export function EditorNavigator({ navigationRail, selectedKey, outline, elementBehaviorResolvers }: EditorNavigatorProps) {
  const { outlineNodes, outlineRoots, outlineNodeCount, collapsedOutlineKeys, selectOutlineNode, toggleOutlineNode } = outline;

  return (
    <aside className={`vhe-navigator${navigationRail ? ' vhe-navigator--with-workspace' : ''}`} aria-label="Document navigation">
      {navigationRail && <div className="vhe-navigation">{navigationRail}</div>}
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
    </aside>
  );
}
