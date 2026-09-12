import { parse, serialize } from 'parse5';

export const RUNTIME_CONTENT_SECURITY_POLICY = [
  "script-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

const blockedTags = new Set(['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'base']);
const urlAttributes = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

function compactUrl(value: string): string {
  return value.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
}

function executableCss(value: string): boolean {
  const compact = value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '').toLowerCase();
  return compact.includes('expression(') || compact.includes('javascript:') || compact.includes('vbscript:') || compact.includes('-moz-binding') || compact.includes('behavior:');
}

function hardenNode(node: any): void {
  if (Array.isArray(node.attrs)) {
    node.attrs = node.attrs.filter((attribute: { name: string; value: string }) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc') return false;
      if (name === 'style' && executableCss(attribute.value)) return false;
      if (urlAttributes.has(name)) {
        const value = compactUrl(attribute.value);
        if (value.startsWith('javascript:') || value.startsWith('vbscript:')) return false;
      }
      return true;
    });
  }

  if (!Array.isArray(node.childNodes)) return;
  node.childNodes = node.childNodes.filter((child: any) => {
    if (blockedTags.has(child.tagName)) return false;
    if (child.tagName !== 'meta') return true;
    const httpEquiv = child.attrs?.find((attribute: { name: string }) => attribute.name.toLowerCase() === 'http-equiv')?.value;
    return httpEquiv?.trim().toLowerCase() !== 'refresh';
  });
  for (const child of node.childNodes) hardenNode(child);
}

/**
 * Builds an inert browser preview from an untrusted runtime projection.
 * Canonical source is never changed; normalization only affects the iframe copy.
 */
export function hardenRuntimeHtml(source: string): string {
  const document = parse(source);
  hardenNode(document);
  const html = serialize(document);
  const policy = `<meta http-equiv="Content-Security-Policy" content="${RUNTIME_CONTENT_SECURITY_POLICY}">`;
  return html.replace(/<head([^>]*)>/i, `<head$1>${policy}`);
}
