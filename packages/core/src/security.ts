import type { EditorProfile } from './types.js';

export function attributeNameAllowed(name: string, profile: EditorProfile): boolean {
  // Validate the complete name before inserting it into HTML source. A
  // permitted data-/aria- prefix does not make whitespace or delimiters safe.
  if (!/^[^\s"'<>/=\u0000-\u001f\u007f]+$/.test(name)) return false;
  const normalized = name.toLowerCase();
  if (normalized.startsWith('on')) return false;
  return profile.html.allowedAttributes.includes(normalized)
    || (profile.html.allowDataAttributes && normalized.startsWith('data-'))
    || Boolean(profile.html.allowAriaAttributes && normalized.startsWith('aria-'));
}

export function decodeCssEscapes(value: string): string {
  return value.replace(/\\(?:([0-9a-f]{1,6})(?:\r\n|[ \n\r\t\f])?|(\r\n|[\n\r\f])|([\s\S]))/gi, (_, hex: string | undefined, newline: string | undefined, literal: string | undefined) => {
    if (!hex) return newline ? '' : literal ?? '';
    const codepoint = Number.parseInt(hex, 16);
    return String.fromCodePoint(codepoint === 0 || codepoint > 0x10ffff || (codepoint >= 0xd800 && codepoint <= 0xdfff)
      ? 0xfffd : codepoint);
  });
}

export function urlValueAllowed(value: string, profile: EditorProfile): boolean {
  const candidate = value.trim();
  if (
    candidate === '' || candidate.startsWith('#') || candidate.startsWith('/') ||
    candidate.startsWith('./') || candidate.startsWith('../') ||
    /^(?:\{\{[\s\S]*\}\}|\[\[[\s\S]*\]\]|<%[\s\S]*%>)$/.test(candidate)
  ) return true;

  try {
    const url = new URL(candidate, 'https://visual-html.local');
    return profile.html.allowedProtocols.includes(url.protocol.toLowerCase());
  } catch {
    return false;
  }
}

export function cssValueAllowed(value: string, profile: EditorProfile): boolean {
  const decoded = decodeCssEscapes(value).replace(/\/\*[\s\S]*?\*\//g, '');
  const compact = decoded.replace(/\s+/g, '').toLowerCase();
  if (
    compact.includes('expression(') || compact.includes('javascript:') ||
    compact.includes('vbscript:') || compact.includes('-moz-binding') ||
    compact.includes('behavior:')
  ) return false;

  const urlPattern = /url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let match: RegExpExecArray | null;
  let urls = 0;
  while ((match = urlPattern.exec(decoded)) !== null) {
    urls += 1;
    if (!urlValueAllowed(match[2], profile)) return false;
  }
  return !/url\s*\(/i.test(decoded) || urls > 0;
}
