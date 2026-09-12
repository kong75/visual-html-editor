export const inspectorStyleProperties = [
  'font-family', 'font-size', 'font-weight', 'color', 'text-align',
  'line-height', 'letter-spacing', 'width', 'height', 'display', 'gap',
  'flex-direction', 'justify-content', 'align-items', 'background-color',
  'opacity', 'padding', 'padding-top', 'padding-right', 'padding-bottom',
  'padding-left', 'margin', 'margin-top', 'margin-right', 'margin-bottom',
  'margin-left', 'border', 'border-width', 'border-style', 'border-color',
  'border-radius', 'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-right-radius', 'border-bottom-left-radius'
] as const;

export function normalizeInspectorStyleValue(property: string, value: string): string {
  if (property === 'border' && /^(?:0(?:\.0+)?px|none)(?:\s|$)/i.test(value.trim())) return '0px';
  if (!['color', 'background-color', 'border-color'].includes(property)) return value.trim();
  const match = value.trim().match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?%?))?\s*\)$/i);
  if (!match) return value.trim();
  const alpha = match[4]?.endsWith('%') ? Number.parseFloat(match[4]) / 100 : Number.parseFloat(match[4] ?? '1');
  if (alpha === 0) return 'transparent';
  const hex = match.slice(1, 4).map((channel) => Math.round(Number(channel)).toString(16).padStart(2, '0')).join('');
  if (alpha >= 1) return `#${hex}`;
  return `#${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}
