import type React from 'react';
import type {
  EditorController,
  ExportResult,
  InlineMark,
  InlineTextStyleProperty,
  NodeKey,
  ParsedNode,
  TextRange
} from '@visual-html/core';
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

/** A non-empty source-backed text range selected in the visual canvas. */
export interface EditorTextSelection {
  nodeKey: NodeKey;
  range: TextRange;
  activeMarks: Readonly<Record<InlineMark, boolean>>;
  /** A value is null when it differs across the selected text. */
  activeStyles: Readonly<Record<InlineTextStyleProperty, string | null>>;
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
  /** Absolute HTTP(S) URL used to resolve relative assets in the preview only. */
  baseUrl?: string;
  /** Keeps selection and preview available while disabling all editing actions. */
  readOnly?: boolean;
  elementBehaviorResolvers?: readonly ElementBehaviorResolver[];
  onSelectionChange?: (selection: EditorSelectionChange) => void;
  /** Reports a non-empty text range and its current formatting, or null when it collapses. */
  onTextSelectionChange?: (selection: EditorTextSelection | null) => void;
  onExport?: (html: string) => void;
  onExportRequest?: () => void | Promise<void>;
}

export interface VisualHtmlEditorHandle {
  /** Commits an active inline edit and returns the latest canonical source. */
  flush(): Promise<ExportResult>;
  /** Opens the HTML file picker when import is enabled. */
  openImportPicker(): void;
  /** Returns the current non-empty text range, if one exists. */
  getTextSelection(): EditorTextSelection | null;
  /** Toggles a semantic mark on the current or supplied range and restores its browser selection. */
  toggleSelectedTextMark(mark: InlineMark, selection?: EditorTextSelection | null): Promise<boolean>;
  /** Applies source-safe inline CSS to the current or supplied range and restores its browser selection. */
  setSelectedTextStyles(
    styles: Readonly<Partial<Record<InlineTextStyleProperty, string>>>,
    selection?: EditorTextSelection | null
  ): Promise<boolean>;
}
