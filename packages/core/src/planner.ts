import { hashText } from './hash.js';
import { duplicateSource } from './duplicate-source.js';
import { setInlineStyleProperty } from './inline-style.js';
import { parseHtmlSource } from './parser.js';
import { applySourcePatches } from './patcher.js';
import { isInlineMarkTag, RichTextRangeError, richTextSourceEdits, setInlineStylesInHtml, toggleInlineMarkInHtml } from './rich-text.js';
import { attributeNameAllowed, cssValueAllowed, urlValueAllowed } from './security.js';
import { validateWorkspace } from './validation.js';
import { attributeInsertionPoint } from './source-attributes.js';
import type {
  CommandFailure,
  DocumentIndex,
  EditorCommand,
  EditorProfile,
  ParsedNode,
  SourcePatch,
  WorkspaceSnapshot
} from './types.js';

export interface PlannedCommand {
  description: string;
  patches: SourcePatch[];
}

export type PlanResult = PlannedCommand | CommandFailure;

const inlineTextStyleProperties = new Set([
  'font-family', 'font-size', 'font-weight', 'color', 'line-height', 'letter-spacing'
]);

function failure(code: string, message: string): CommandFailure {
  return { ok: false, code, message };
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;');
}

function getSource(workspace: WorkspaceSnapshot, node: ParsedNode): string | undefined {
  return workspace.files.get(node.fileId)?.content;
}

function patchForRange(
  node: ParsedNode,
  source: string,
  start: number,
  end: number,
  replacement: string
): SourcePatch {
  return {
    fileId: node.fileId,
    start,
    end,
    expectedHash: hashText(source.slice(start, end)),
    replacement
  };
}

function setAttributePatch(
  workspace: WorkspaceSnapshot,
  node: ParsedNode,
  name: string,
  value: string | null
): SourcePatch | CommandFailure {
  const source = getSource(workspace, node);
  if (!source || node.virtual || !node.startTagRange) {
    return failure('node-not-editable', 'The selected element has no editable source location.');
  }

  const existing = node.attributes.get(name.toLowerCase());
  if (existing?.range) {
    if (value === null) {
      return patchForRange(node, source, existing.range.start, existing.range.end, '');
    }
    return patchForRange(
      node,
      source,
      existing.range.start,
      existing.range.end,
      `${name}="${escapeAttribute(value)}"`
    );
  }

  if (value === null) {
    return failure('attribute-missing', `Attribute “${name}” is not present.`);
  }
  const point = attributeInsertionPoint(source, node);
  if (point === undefined) return failure('node-not-editable', 'Unable to locate the element start tag.');
  return patchForRange(node, source, point, point, ` ${name}="${escapeAttribute(value)}"`);
}

function updateStyleValue(styleText: string, property: string, value: string | null): string {
  return setInlineStyleProperty(styleText, property, value);
}

function issueCounts(issues: ReturnType<typeof validateWorkspace>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    if (issue.severity !== 'blocking' && issue.severity !== 'error') continue;
    const signature = `${issue.severity}:${issue.code}:${issue.message}`;
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }
  return counts;
}

function newPolicyIssue(
  workspace: WorkspaceSnapshot,
  index: DocumentIndex,
  profile: EditorProfile,
  patches: readonly SourcePatch[]
): CommandFailure | undefined {
  const { workspace: candidateWorkspace } = applySourcePatches(workspace, patches);
  const file = candidateWorkspace.files.get(candidateWorkspace.entryFileId)!;
  let keyCounter = 0;
  const candidateIndex = parseHtmlSource(file.content, {
    revision: candidateWorkspace.revision,
    fileId: file.id,
    allocateKey: () => `candidate-${++keyCounter}`
  });
  const before = issueCounts(validateWorkspace(workspace, index, profile));
  const afterIssues = validateWorkspace(candidateWorkspace, candidateIndex, profile);
  const seen = new Map<string, number>();

  for (const issue of afterIssues) {
    if (issue.severity !== 'blocking' && issue.severity !== 'error') continue;
    const signature = `${issue.severity}:${issue.code}:${issue.message}`;
    const occurrence = (seen.get(signature) ?? 0) + 1;
    seen.set(signature, occurrence);
    if (occurrence > (before.get(signature) ?? 0)) return failure('policy-denied', issue.message);
  }
  return undefined;
}

export function planCommand(
  command: EditorCommand,
  workspace: WorkspaceSnapshot,
  index: DocumentIndex,
  profile: EditorProfile
): PlanResult {
  const planned = planCommandUnchecked(command, workspace, index, profile);
  // Source mode intentionally preserves disallowed input and reports issues.
  // Every visual command must pass the same candidate-document policy check.
  if ('ok' in planned || command.type === 'applySource') return planned;
  return newPolicyIssue(workspace, index, profile, planned.patches) ?? planned;
}

function planCommandUnchecked(
  command: EditorCommand,
  workspace: WorkspaceSnapshot,
  index: DocumentIndex,
  profile: EditorProfile
): PlanResult {
  const entryFile = workspace.files.get(workspace.entryFileId);
  if (!entryFile) return failure('entry-file-missing', 'The entry HTML file is missing.');

  if (command.type === 'applySource') {
    if (!profile.capabilities.editSource) return failure('capability-denied', 'Source editing is disabled.');
    return {
      description: 'Edit HTML source',
      patches: [{
        fileId: entryFile.id,
        start: 0,
        end: entryFile.content.length,
        expectedHash: hashText(entryFile.content),
        replacement: command.source
      }]
    };
  }

  if (command.type === 'insertImage') {
    if (!profile.capabilities.insertImages || !profile.html.allowedTags.includes('img')) {
      return failure('capability-denied', 'Image insertion is disabled.');
    }
    if (!urlValueAllowed(command.src, profile)) return failure('policy-denied', 'Image URL uses a disallowed protocol.');
    const html = `<img src="${escapeAttribute(command.src)}" alt="${escapeAttribute(command.alt)}" style="max-width: 100%; height: auto;">`;
    const target = command.targetNodeKey ? index.nodes.get(command.targetNodeKey) : undefined;
    if (target?.range) {
      const source = getSource(workspace, target);
      if (!source) return failure('source-missing', 'The selected element source is unavailable.');
      return {
        description: 'Insert image',
        patches: [patchForRange(target, source, target.range.end, target.range.end, html)]
      };
    }
    const body = [...index.nodes.values()].find((node) => node.tagName === 'body' && node.innerRange);
    const insertion = body?.innerRange?.end ?? entryFile.content.length;
    return {
      description: 'Insert image',
      patches: [{
        fileId: entryFile.id,
        start: insertion,
        end: insertion,
        expectedHash: hashText(''),
        replacement: html
      }]
    };
  }

  const node = index.nodes.get(command.nodeKey);
  if (!node) return failure('node-not-found', 'The selected element no longer exists.');
  const source = getSource(workspace, node);
  if (!source) return failure('source-missing', 'The selected element source is unavailable.');

  switch (command.type) {
    case 'replaceImage': {
      if (!profile.capabilities.replaceImages) return failure('capability-denied', 'Image replacement is disabled.');
      if (node.tagName !== 'img') return failure('node-not-editable', 'Image replacement requires an image element.');
      if (command.src !== null && !urlValueAllowed(command.src, profile)) return failure('policy-denied', 'Image URL uses a disallowed protocol.');
      const patches: SourcePatch[] = [];
      const update = (target: ParsedNode, name: string, value: string | null): CommandFailure | undefined => {
        if (value === null && !target.attributes.has(name)) return;
        if (value !== null && !attributeNameAllowed(name, profile)) return failure('policy-denied', `Attribute “${name}” is not allowed.`);
        const patch = setAttributePatch(workspace, target, name, value);
        if ('ok' in patch) return patch;
        patches.push(patch);
      };
      const sourceError = update(node, 'src', command.src);
      if (sourceError) return sourceError;
      if (command.alt !== undefined) {
        const altError = update(node, 'alt', command.alt);
        if (altError) return altError;
      }
      const picture = node.parentKey ? index.nodes.get(node.parentKey) : undefined;
      const candidates = [node, ...(picture?.tagName === 'picture'
        ? picture.childKeys.map((key) => index.nodes.get(key)!).filter((child) => child.tagName === 'source') : [])];
      for (const candidate of candidates) {
        for (const name of ['srcset', 'sizes']) {
          const error = update(candidate, name, null);
          if (error) return error;
        }
      }
      return { description: 'Replace image', patches };
    }

    case 'setText': {
      if (!profile.capabilities.editText) return failure('capability-denied', 'Text editing is disabled.');
      if (node.virtual || !node.innerRange || node.hasElementChildren) {
        return failure('rich-text-required', 'This element contains nested markup and cannot be edited as plain text.');
      }
      return {
        description: `Edit <${node.tagName}> text`,
        patches: [patchForRange(node, source, node.innerRange.start, node.innerRange.end, escapeText(command.text))]
      };
    }

    case 'setRichText': {
      if (!profile.capabilities.editText) return failure('capability-denied', 'Text editing is disabled.');
      if (node.virtual || !node.innerRange) {
        return failure('node-not-editable', 'The selected element has no editable rich-text source.');
      }
      const currentHtml = source.slice(node.innerRange.start, node.innerRange.end);
      if (command.html === currentHtml) return failure('no-change', 'The rich text is already current.');
      const sourceEdits = richTextSourceEdits(currentHtml, command.html);
      if (sourceEdits?.length === 0) return failure('no-change', 'The rich text is already current.');
      return {
        description: `Edit <${node.tagName}> rich text`,
        patches: sourceEdits
          ? sourceEdits.map((edit) => patchForRange(
              node,
              source,
              node.innerRange!.start + edit.start,
              node.innerRange!.start + edit.end,
              edit.replacement
            ))
          : [patchForRange(node, source, node.innerRange.start, node.innerRange.end, command.html)]
      };
    }

    case 'toggleInlineMark': {
      if (!profile.capabilities.editText) return failure('capability-denied', 'Text editing is disabled.');
      if (node.virtual || !node.innerRange) {
        return failure('node-not-editable', 'The selected element has no editable rich-text source.');
      }
      const innerHtml = source.slice(node.innerRange.start, node.innerRange.end);
      try {
        const rootIsMark = isInlineMarkTag(node.tagName, command.mark);
        // Retain one neutral root for IDs/attributes while removing inherited
        // semantic formatting from all or part of a standalone mark element.
        const transformed = toggleInlineMarkInHtml(rootIsMark ? `<${command.mark}>${innerHtml}</${command.mark}>` : innerHtml, command.range, command.mark);
        if (transformed.action === 'add' && !profile.html.allowedTags.includes(command.mark)) {
          return failure('policy-denied', `<${command.mark}> is not allowed by the ${profile.label} profile.`);
        }
        if (!rootIsMark && transformed.html === innerHtml) return failure('no-change', 'The selected formatting is already applied.');
        const patches = [patchForRange(node, source, node.innerRange.start, node.innerRange.end, transformed.html)];
        if (rootIsMark) {
          if (!profile.html.allowedTags.includes('span')) return failure('policy-denied', 'Removing root formatting requires an allowed span element.');
          patches.push(patchForRange(node, source, node.startTagRange!.start + 1, node.startTagRange!.start + 1 + node.tagName.length, 'span'));
          patches.push(patchForRange(node, source, node.endTagRange!.start + 2, node.endTagRange!.start + 2 + node.tagName.length, 'span'));
        }
        return {
          description: `${transformed.action === 'add' ? 'Apply' : 'Remove'} <${command.mark}> formatting`,
          patches
        };
      } catch (error) {
        if (error instanceof RichTextRangeError) return failure('invalid-text-range', error.message);
        throw error;
      }
    }

    case 'setInlineStyles': {
      if (!profile.capabilities.editText || !profile.capabilities.editStyles) {
        return failure('capability-denied', 'Selected-text style editing is disabled.');
      }
      if (node.virtual || !node.innerRange) {
        return failure('node-not-editable', 'The selected element has no editable rich-text source.');
      }
      if (!profile.html.allowedTags.includes('span') || !attributeNameAllowed('style', profile)) {
        return failure('policy-denied', `Styled text spans are not allowed by the ${profile.label} profile.`);
      }
      const styles = Object.entries(command.styles);
      if (styles.length === 0) return failure('no-change', 'No selected-text styles were provided.');
      for (const [rawProperty, value] of styles) {
        const property = rawProperty.toLowerCase();
        if (!inlineTextStyleProperties.has(property)) {
          return failure('invalid-style', `CSS property “${property}” cannot be applied to a text selection.`);
        }
        if (!profile.html.allowedCssProperties.includes(property)) {
          return failure('policy-denied', `CSS property “${property}” is not allowed.`);
        }
        if (typeof value !== 'string' || !value.trim() || !cssValueAllowed(value, profile)) {
          return failure('policy-denied', `CSS value for “${property}” is empty or contains a disallowed URL or executable construct.`);
        }
      }
      const innerHtml = source.slice(node.innerRange.start, node.innerRange.end);
      try {
        const transformed = setInlineStylesInHtml(innerHtml, command.range, command.styles);
        if (transformed.html === innerHtml) return failure('no-change', 'The selected text styles are already applied.');
        return {
          description: styles.length === 1 ? `Style selected text with ${styles[0][0]}` : 'Style selected text',
          patches: [patchForRange(node, source, node.innerRange.start, node.innerRange.end, transformed.html)]
        };
      } catch (error) {
        if (error instanceof RichTextRangeError) return failure('invalid-text-range', error.message);
        return failure('invalid-style', 'The selected-text style could not be parsed as a CSS declaration.');
      }
    }

    case 'setAttribute': {
      if (!attributeNameAllowed(command.name, profile)) {
        return failure('policy-denied', `Attribute “${command.name}” is not allowed.`);
      }
      if (command.name.toLowerCase() === 'style' && !profile.capabilities.editStyles) {
        return failure('capability-denied', 'Style editing is disabled.');
      }
      if (command.value !== null && ['href', 'src', 'action', 'formaction'].includes(command.name.toLowerCase()) && !urlValueAllowed(command.value, profile)) {
        return failure('policy-denied', `Attribute “${command.name}” uses a disallowed protocol.`);
      }
      const patch = setAttributePatch(workspace, node, command.name, command.value);
      if ('ok' in patch) return patch;
      return { description: `Update ${command.name}`, patches: [patch] };
    }

    case 'setStyle': {
      if (!profile.capabilities.editStyles) return failure('capability-denied', 'Style editing is disabled.');
      const property = command.property.toLowerCase();
      if (!profile.html.allowedCssProperties.includes(property)) {
        return failure('policy-denied', `CSS property “${property}” is not allowed.`);
      }
      if (command.value !== null && !cssValueAllowed(command.value, profile)) {
        return failure('policy-denied', `CSS value for “${property}” contains a disallowed URL or executable construct.`);
      }
      const existingStyle = node.attributes.get('style')?.value ?? '';
      let nextStyle: string;
      try {
        nextStyle = updateStyleValue(existingStyle, property, command.value);
      } catch {
        return failure('invalid-style', 'The inline style or replacement value could not be parsed as a single declaration.');
      }
      const patch = setAttributePatch(workspace, node, 'style', nextStyle || null);
      if ('ok' in patch) return patch;
      return { description: `Set ${property}`, patches: [patch] };
    }

    case 'setStyles': {
      if (!profile.capabilities.editStyles) return failure('capability-denied', 'Style editing is disabled.');
      let nextStyle = node.attributes.get('style')?.value ?? '';
      try {
        for (const [rawProperty, value] of Object.entries(command.styles)) {
          const property = rawProperty.toLowerCase();
          if (!profile.html.allowedCssProperties.includes(property)) {
            return failure('policy-denied', `CSS property “${property}” is not allowed.`);
          }
          if (value !== null && !cssValueAllowed(value, profile)) {
            return failure('policy-denied', `CSS value for “${property}” contains a disallowed URL or executable construct.`);
          }
          nextStyle = updateStyleValue(nextStyle, property, value);
        }
      } catch {
        return failure('invalid-style', 'The inline style or replacement value could not be parsed as a single declaration.');
      }
      const patch = setAttributePatch(workspace, node, 'style', nextStyle || null);
      if ('ok' in patch) return patch;
      return { description: 'Update element layout', patches: [patch] };
    }

    case 'removeNode': {
      if (!profile.capabilities.deleteElements) return failure('capability-denied', 'Deleting elements is disabled.');
      if (!node.range || node.virtual || ['html', 'head', 'body'].includes(node.tagName)) {
        return failure('node-not-editable', 'This structural element cannot be deleted.');
      }
      return {
        description: `Delete <${node.tagName}>`,
        patches: [patchForRange(node, source, node.range.start, node.range.end, '')]
      };
    }

    case 'duplicateNode': {
      if (!profile.capabilities.duplicateElements) return failure('capability-denied', 'Duplicating elements is disabled.');
      if (!node.range || node.virtual || ['html', 'head', 'body'].includes(node.tagName)) {
        return failure('node-not-editable', 'This structural element cannot be duplicated.');
      }
      const original = duplicateSource(source, node, index);
      return {
        description: `Duplicate <${node.tagName}>`,
        patches: [patchForRange(node, source, node.range.end, node.range.end, original)]
      };
    }
  }
}
