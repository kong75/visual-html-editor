import React from 'react';
import type { NodeKey, ParsedNode } from '@visual-html/core';
import { resolveElementBehavior, type ElementBehaviorResolver } from '../element-behavior.js';
import { attributeValue } from '../source-node.js';

export const outlineHiddenTags = new Set(['html', 'head', 'style', 'script', 'meta', 'title', 'link', 'base', 'noscript']);

const outlineTableStructureTags = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th']);

export function visibleOutlineNodes(keys: readonly NodeKey[], nodes: ReadonlyMap<NodeKey, ParsedNode>): ParsedNode[] {
  const visible: ParsedNode[] = [];
  const append = (key: NodeKey) => {
    const child = nodes.get(key);
    if (!child || outlineHiddenTags.has(child.tagName)) return;
    if (child.virtual) {
      child.childKeys.forEach(append);
      return;
    }
    visible.push(child);
  };
  keys.forEach(append);
  return visible;
}

function visibleOutlineChildren(node: ParsedNode, nodes: ReadonlyMap<NodeKey, ParsedNode>): ParsedNode[] {
  return visibleOutlineNodes(node.childKeys, nodes);
}

function compactOutlineText(value: string, limit = 120): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  return compact.length > limit ? `${compact.slice(0, limit - 1)}…` : compact;
}

function outlineName(node: ParsedNode, nodes: ReadonlyMap<NodeKey, ParsedNode>, kind: string): string {
  if (kind === 'Text' || kind === 'Heading') {
    const text = compactOutlineText(node.textContent);
    if (text) return `“${text}”`;
  }
  if (kind === 'Image') {
    const alt = compactOutlineText(attributeValue(node, 'alt'));
    if (alt) return `“${alt}”`;
  }
  const label = attributeValue(node, 'data-screen-label') || attributeValue(node, 'aria-label') || attributeValue(node, 'id');
  if (label) return compactOutlineText(label);
  if (kind === 'Section') {
    const heading = visibleOutlineChildren(node, nodes)
      .find((child) => child && /^h[1-3]$/.test(child.tagName));
    const headingText = compactOutlineText(heading?.textContent ?? '');
    if (headingText) return headingText;
  }
  const className = attributeValue(node, 'class').split(/\s+/).find(Boolean);
  return className ? `.${className}` : '';
}

export function initialCollapsedOutlineKeys(nodes: readonly ParsedNode[], resolvers: readonly ElementBehaviorResolver[]): Set<NodeKey> {
  const nodeMap = new Map(nodes.map((node) => [node.key, node]));
  const collapsed = new Set<NodeKey>();
  for (const node of nodes) {
    if (node.virtual || outlineHiddenTags.has(node.tagName)) continue;
    const visibleChildren = visibleOutlineChildren(node, nodeMap).length > 0;
    if (!visibleChildren || resolveElementBehavior(node, nodeMap, resolvers).kind !== 'Group' || outlineTableStructureTags.has(node.tagName)) continue;
    let depth = 0;
    let parentKey = node.parentKey;
    while (parentKey) {
      const parent = nodeMap.get(parentKey);
      if (!parent) break;
      if (!parent.virtual && !outlineHiddenTags.has(parent.tagName) && !['html', 'body'].includes(parent.tagName)) depth += 1;
      parentKey = parent.parentKey;
    }
    if (depth >= 2) collapsed.add(node.key);
  }
  return collapsed;
}

interface ComponentOutlineNodeProps {
  node: ParsedNode;
  nodes: ReadonlyMap<NodeKey, ParsedNode>;
  selectedKey: NodeKey | null;
  collapsedKeys: ReadonlySet<NodeKey>;
  depth: number;
  behaviorResolvers: readonly ElementBehaviorResolver[];
  onSelect: (key: NodeKey) => void;
  onToggle: (key: NodeKey) => void;
}

export function ComponentOutlineNode({ node, nodes, selectedKey, collapsedKeys, depth, behaviorResolvers, onSelect, onToggle }: ComponentOutlineNodeProps) {
  const children = visibleOutlineChildren(node, nodes);
  const collapsed = collapsedKeys.has(node.key);
  const kind = resolveElementBehavior(node, nodes, behaviorResolvers).kind;
  const name = outlineName(node, nodes, kind);
  const accessibleName = `${kind}${name ? `: ${name}` : ''} (${node.tagName})`;

  return (
    <div
      className={`vhe-outline-node${selectedKey === node.key ? ' vhe-outline-node--selected' : ''}`}
      data-outline-node-key={node.key}
      role="treeitem"
      aria-label={accessibleName}
      aria-selected={selectedKey === node.key}
      aria-expanded={children.length ? !collapsed : undefined}
    >
      <div className="vhe-outline-node__row" style={{ paddingLeft: 6 + Math.min(depth, 6) * 12 }}>
        {children.length ? (
          <button type="button" className="vhe-outline-node__toggle" onClick={() => onToggle(node.key)} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${accessibleName}`}>
            <span aria-hidden="true" />
          </button>
        ) : <span className="vhe-outline-node__toggle-space" />}
        <button type="button" className="vhe-outline-node__select" onClick={() => onSelect(node.key)} aria-label={`Select ${accessibleName}`} title={accessibleName}>
          <span className={`vhe-outline-node__glyph vhe-outline-node__glyph--${kind.toLowerCase()}`} aria-hidden="true" />
          <span className="vhe-outline-node__label">
            <span className="vhe-outline-node__kind">{kind}</span>
            {name && <span className="vhe-outline-node__name">{name}</span>}
          </span>
          <code className="vhe-outline-node__tag" title={`<${node.tagName}>`}>&lt;{node.tagName}&gt;</code>
        </button>
      </div>
      {!collapsed && children.length > 0 && (
        <div role="group">
          {children.map((child) => (
            <ComponentOutlineNode
              key={child.key}
              node={child}
              nodes={nodes}
              selectedKey={selectedKey}
              collapsedKeys={collapsedKeys}
              depth={depth + 1}
              behaviorResolvers={behaviorResolvers}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
