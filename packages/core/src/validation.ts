import { parse as parseCss, type ChildNode } from 'postcss';
import { parseInlineStyle } from './inline-style.js';
import { attributeNameAllowed, cssValueAllowed, decodeCssEscapes, urlValueAllowed } from './security.js';
import type {
  DocumentIndex,
  EditorProfile,
  ValidationIssue,
  WorkspaceSnapshot
} from './types.js';

type IssueLocation = Omit<ValidationIssue, 'code' | 'severity' | 'message'>;

function validateDeclaration(
  property: string,
  value: string,
  profile: EditorProfile,
  issueBase: IssueLocation
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const normalizedProperty = decodeCssEscapes(property).toLowerCase();
  if (!profile.html.allowedCssProperties.includes(normalizedProperty)) {
    issues.push({
      ...issueBase,
      code: 'css-property-not-allowed',
      severity: 'blocking',
      message: `CSS property “${normalizedProperty}” is not allowed by the ${profile.label} profile.`
    });
  }
  if (!cssValueAllowed(value, profile)) {
    issues.push({
      ...issueBase,
      code: 'css-value-not-allowed',
      severity: 'blocking',
      message: `CSS value for “${normalizedProperty}” contains a disallowed URL or executable construct.`
    });
  }
  return issues;
}

function validateStyle(
  style: string,
  profile: EditorProfile,
  issueBase: IssueLocation
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  try {
    for (const declaration of parseInlineStyle(style)) {
      issues.push(...validateDeclaration(declaration.property, declaration.value, profile, issueBase));
    }
  } catch {
    issues.push({
      ...issueBase,
      code: 'invalid-inline-style',
      severity: 'blocking',
      message: 'Inline style could not be parsed.'
    });
  }
  return issues;
}

function validateStylesheet(css: string, offset: number, profile: EditorProfile, issueBase: IssueLocation): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const location = (node: ChildNode): IssueLocation => ({
    ...issueBase,
    range: node.source?.start && node.source.end
      ? { start: offset + node.source.start.offset, end: offset + node.source.end.offset }
      : issueBase.range
  });
  try {
    const root = parseCss(css, { from: undefined });
    root.walkDecls((declaration) => {
      issues.push(...validateDeclaration(declaration.prop, declaration.value, profile, location(declaration)));
    });
    root.walkAtRules((rule) => {
      // PostCSS can split an escaped identifier between name and params.
      // Reassemble its header before recognizing the import URL grammar.
      const header = decodeCssEscapes(rule.name + (rule.raws.afterName ?? '') + rule.params)
        .replace(/\/\*[\s\S]*?\*\//g, '');
      const importParams = header.match(/^import(?=[\s"'(]|$)([\s\S]*)$/i)?.[1];
      const name = importParams !== undefined ? 'import' : decodeCssEscapes(rule.name).toLowerCase();
      // @import permits a quoted URL without url(), unlike declarations.
      const importedUrl = importParams?.match(/^\s*(['"])([\s\S]*?)\1/)?.[2];
      if (!cssValueAllowed(rule.params, profile) || (importedUrl !== undefined && !urlValueAllowed(importedUrl, profile))) {
        issues.push({
          ...location(rule), code: 'css-value-not-allowed', severity: 'blocking',
          message: `CSS @${name} contains a disallowed URL or executable construct.`
        });
      }
    });
  } catch {
    issues.push({ ...issueBase, code: 'invalid-stylesheet', severity: 'blocking', message: 'The stylesheet could not be parsed and validated.' });
  }
  return issues;
}

export function validateWorkspace(
  workspace: WorkspaceSnapshot,
  index: DocumentIndex,
  profile: EditorProfile
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const node of index.nodes.values()) {
    const issueBase = { fileId: node.fileId, nodeKey: node.key, range: node.range };
    if (!node.virtual && !profile.html.allowedTags.includes(node.tagName)) {
      issues.push({
        ...issueBase,
        code: 'html-tag-not-allowed',
        severity: 'blocking',
        message: `<${node.tagName}> is not allowed by the ${profile.label} profile.`
      });
    }

    if (node.tagName === 'meta' && node.attributes.get('http-equiv')?.value.trim().toLowerCase() === 'refresh') {
      issues.push({
        ...issueBase, code: 'meta-refresh-not-allowed', severity: 'blocking',
        message: 'Automatic page refreshes and redirects are not allowed.'
      });
    }
    if (node.tagName === 'style') {
      const offset = node.startTagRange?.end ?? node.range?.start ?? 0;
      const source = workspace.files.get(node.fileId)?.content;
      // An unterminated raw-text element can have an unfinished end offset
      // from the HTML parser. Its stylesheet still consumes the rest of source.
      const end = node.endTagRange?.start ?? (node.range && node.range.end >= offset ? node.range.end : source?.length);
      const css = source !== undefined ? source.slice(offset, end) : node.textContent;
      issues.push(...validateStylesheet(css, offset, profile, issueBase));
    }

    for (const attribute of node.attributes.values()) {
      const name = attribute.name.toLowerCase();
      if (!attributeNameAllowed(name, profile)) {
        issues.push({
          ...issueBase,
          range: attribute.range ?? node.range,
          code: 'html-attribute-not-allowed',
          severity: 'blocking',
          message: `Attribute “${attribute.name}” is not allowed.`
        });
      }
      if (['href', 'src', 'action', 'formaction'].includes(name) && !urlValueAllowed(attribute.value, profile)) {
        issues.push({
          ...issueBase,
          range: attribute.range ?? node.range,
          code: 'url-protocol-not-allowed',
          severity: 'blocking',
          message: `The URL used by “${attribute.name}” has a disallowed protocol.`
        });
      }
      if (name === 'style') {
        issues.push(...validateStyle(attribute.value, profile, issueBase));
      }
    }

    if (node.tagName === 'img' && !node.attributes.get('alt')?.value.trim()) {
      issues.push({
        ...issueBase,
        code: 'image-alt-missing',
        severity: 'warning',
        message: 'Image is missing alternative text.'
      });
    }
  }

  if (!workspace.files.get(workspace.entryFileId)?.content.trim()) {
    issues.push({
      code: 'document-empty',
      severity: 'error',
      message: 'The HTML document is empty.',
      fileId: workspace.entryFileId
    });
  }
  return issues;
}
