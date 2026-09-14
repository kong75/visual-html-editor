/// <reference path="./css-tree.d.ts" />

import parseCss from 'css-tree/parser';
import type { AtrulePlain, CssNode, CssNodePlain, DeclarationPlain } from 'css-tree';
import { parseInlineStyle } from './inline-style.js';
import { attributeNameAllowed, cssValueAllowed, decodeCssEscapes, urlValueAllowed } from './security.js';
import type {
  DocumentIndex,
  EditorProfile,
  ValidationIssue,
  WorkspaceSnapshot
} from './types.js';

type IssueLocation = Omit<ValidationIssue, 'code' | 'severity' | 'message'>;

function assertBalancedStylesheet(css: string): void {
  const closingToken = new Map([['{', '}'], ['[', ']'], ['(', ')']]);
  const stack: string[] = [];
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let comment = false;

  for (let index = 0; index < css.length; index += 1) {
    const character = css[index];
    const next = css[index + 1];
    if (comment) {
      if (character === '*' && next === '/') {
        comment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '/' && next === '*') {
      comment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (closingToken.has(character)) stack.push(character);
    else if (character === '}' || character === ']' || character === ')') {
      const opening = stack.pop();
      if (!opening || closingToken.get(opening) !== character) throw new Error('Unbalanced CSS token.');
    }
  }

  if (quote || comment || escaped || stack.length > 0) throw new Error('Unclosed CSS token.');
}

function walkCss(node: CssNodePlain, visit: (node: CssNodePlain) => void): void {
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === 'object' && 'type' in child) walkCss(child as CssNodePlain, visit);
      }
    } else if (value && typeof value === 'object' && 'type' in value) {
      walkCss(value as CssNodePlain, visit);
    }
  }
}

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
  const location = (node: CssNode): IssueLocation => ({
    ...issueBase,
    range: node.loc
      ? { start: offset + node.loc.start.offset, end: offset + node.loc.end.offset }
      : issueBase.range
  });
  try {
    assertBalancedStylesheet(css);
    const root = parseCss(css, { positions: true, list: false });
    walkCss(root, (node) => {
      if (node.type === 'Declaration') {
        const declaration = node as DeclarationPlain;
        const value = declaration.value.loc
          ? css.slice(declaration.value.loc.start.offset, declaration.value.loc.end.offset)
          : '';
        issues.push(...validateDeclaration(declaration.property, value, profile, location(declaration as CssNode)));
      } else if (node.type === 'Atrule') {
        const rule = node as AtrulePlain;
        const params = rule.prelude?.loc
          ? css.slice(rule.prelude.loc.start.offset, rule.prelude.loc.end.offset)
          : '';
        const header = decodeCssEscapes(`${rule.name} ${params}`).replace(/\/\*[\s\S]*?\*\//g, '');
        const importParams = header.match(/^import(?=[\s"'(]|$)([\s\S]*)$/i)?.[1];
        const name = importParams !== undefined ? 'import' : decodeCssEscapes(rule.name).toLowerCase();
        // @import permits a quoted URL without url(), unlike declarations.
        const importedUrl = importParams?.match(/^\s*(['"])([\s\S]*?)\1/)?.[2];
        if (!cssValueAllowed(params, profile) || (importedUrl !== undefined && !urlValueAllowed(importedUrl, profile))) {
          issues.push({
            ...location(rule as CssNode), code: 'css-value-not-allowed', severity: 'blocking',
            message: `CSS @${name} contains a disallowed URL or executable construct.`
          });
        }
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
