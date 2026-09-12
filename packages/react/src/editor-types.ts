import type React from 'react';
import type { EditorController, NodeKey, ParsedNode } from '@visual-html/core';
import type { ElementBehaviorResolver } from './element-behavior.js';

export interface ResolvedAsset {
  url: string;
  alt?: string;
}

export interface AssetAdapter {
  upload(file: File): Promise<ResolvedAsset>;
}

export interface EditorSelectionChange {
  nodeKey: NodeKey | null;
  node?: ParsedNode;
}

export interface HtmlImportInput {
  file: File;
  html: string;
}

export interface HtmlImportPreview {
  title?: string;
  description?: string;
  warnings?: readonly string[];
  hasUnsavedChanges?: boolean;
}

export interface HtmlImportResult {
  message?: string;
}

export interface HtmlImportAdapter {
  accept?: string;
  maxBytes?: number;
  prepare?: (input: HtmlImportInput) => HtmlImportPreview | Promise<HtmlImportPreview>;
  apply: (input: HtmlImportInput) => void | HtmlImportResult | Promise<void | HtmlImportResult>;
}

export interface VisualHtmlEditorProps {
  controller: EditorController;
  assetAdapter?: AssetAdapter;
  className?: string;
  brandHref?: string;
  documentTitle?: string;
  toolbarContent?: React.ReactNode;
  navigationRail?: React.ReactNode;
  /** Additional unsaved workspace changes, such as deck structure or another slide. */
  workspaceDirty?: boolean;
  sidebarHeader?: React.ReactNode;
  importAdapter?: HtmlImportAdapter;
  elementBehaviorResolvers?: readonly ElementBehaviorResolver[];
  onSelectionChange?: (selection: EditorSelectionChange) => void;
  onExport?: (html: string) => void;
  onExportRequest?: () => void | Promise<void>;
}
