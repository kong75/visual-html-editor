export interface FontFamilyOption {
  value: string;
  label: string;
  description: string;
  fontFamily: string;
}

export const fontFamilyOptions: readonly FontFamilyOption[] = [
  { value: 'inherit', label: 'Inherit', description: 'Use the parent font', fontFamily: 'inherit' },
  { value: 'system-ui, sans-serif', label: 'System UI', description: 'Native interface sans serif', fontFamily: 'system-ui, sans-serif' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial', description: 'Web-safe sans serif', fontFamily: 'Arial, Helvetica, sans-serif' },
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif', label: 'Helvetica Neue', description: 'Modern sans serif', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana', description: 'Wide, readable sans serif', fontFamily: 'Verdana, Geneva, sans-serif' },
  { value: '"Trebuchet MS", Arial, sans-serif', label: 'Trebuchet MS', description: 'Humanist sans serif', fontFamily: '"Trebuchet MS", Arial, sans-serif' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Georgia', description: 'Screen-friendly serif', fontFamily: 'Georgia, "Times New Roman", serif' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman', description: 'Classic serif', fontFamily: '"Times New Roman", Times, serif' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New', description: 'Web-safe monospace', fontFamily: '"Courier New", Courier, monospace' },
  { value: 'ui-monospace, SFMono-Regular, Consolas, monospace', label: 'System Mono', description: 'Native monospace', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }
];

function primaryFamily(value: string): string {
  return value.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '').toLowerCase() ?? '';
}

export function fontFamilyOptionsFor(value: string | null | undefined): readonly FontFamilyOption[] {
  if (!value || fontFamilyOptions.some((option) => option.value === value)) return fontFamilyOptions;
  const matching = fontFamilyOptions.find((option) => primaryFamily(option.value) === primaryFamily(value));
  return [
    {
      value,
      label: matching?.label ?? value,
      description: 'Current document font',
      fontFamily: value
    },
    ...fontFamilyOptions.filter((option) => option !== matching)
  ];
}
