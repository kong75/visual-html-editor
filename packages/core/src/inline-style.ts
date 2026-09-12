export interface InlineStyleDeclaration {
  property: string;
  value: string;
  important: boolean;
}

function splitDeclarations(source: string): string[] {
  const declarations: string[] = [];
  let start = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let comment = false;
  let parentheses = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
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
    if (character === '(') parentheses += 1;
    else if (character === ')') {
      if (parentheses === 0) throw new Error('Unexpected closing parenthesis in inline style.');
      parentheses -= 1;
    } else if ((character === '{' || character === '}') && parentheses === 0) {
      throw new Error('Blocks are not valid inside an inline style.');
    } else if (character === ';' && parentheses === 0) {
      declarations.push(source.slice(start, index));
      start = index + 1;
    }
  }

  if (quote || comment || parentheses !== 0) throw new Error('Unclosed CSS token in inline style.');
  declarations.push(source.slice(start));
  return declarations;
}

function declarationColon(source: string): number {
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let comment = false;
  let parentheses = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
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
    if (character === '"' || character === "'") quote = character;
    else if (character === '(') parentheses += 1;
    else if (character === ')') parentheses -= 1;
    else if (character === ':' && parentheses === 0) return index;
  }
  return -1;
}

function splitImportant(value: string): { value: string; important: boolean } {
  const match = value.match(/^(.*?)(?:\s*!\s*important\s*)$/i);
  return match ? { value: match[1].trim(), important: true } : { value: value.trim(), important: false };
}

export function parseInlineStyle(source: string): InlineStyleDeclaration[] {
  return splitDeclarations(source).flatMap((rawDeclaration) => {
    const declaration = rawDeclaration.trim();
    if (!declaration || /^\/\*[\s\S]*\*\/$/.test(declaration)) return [];
    const colon = declarationColon(declaration);
    if (colon < 1) throw new Error('Inline style declaration is missing a property or colon.');
    const property = declaration.slice(0, colon).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!/^(?:--[\w-]+|-?[A-Za-z_][\w-]*)$/.test(property)) {
      throw new Error('Inline style contains an invalid property name.');
    }
    const parsedValue = splitImportant(declaration.slice(colon + 1));
    return [{ property, ...parsedValue }];
  });
}

export function serializeInlineStyle(declarations: readonly InlineStyleDeclaration[]): string {
  return declarations
    .map(({ property, value, important }) => `${property}: ${value}${important ? ' !important' : ''}`)
    .join('; ');
}

export function setInlineStyleProperty(source: string, property: string, nextValue: string | null): string {
  const declarations = parseInlineStyle(source);
  const normalizedProperty = property.toLowerCase();
  const replacement = nextValue === null ? [] : parseInlineStyle(`${property}: ${nextValue}`);
  if (nextValue !== null && (replacement.length !== 1 || replacement[0].property.toLowerCase() !== normalizedProperty)) {
    throw new Error('A style value must contain exactly one CSS declaration.');
  }
  const parsedNextValue = replacement[0] ?? null;
  const matching = declarations.filter((declaration) => declaration.property.toLowerCase() === normalizedProperty);
  const next = declarations.filter((declaration) => declaration.property.toLowerCase() !== normalizedProperty);
  if (parsedNextValue !== null) next.push({
    property,
    value: parsedNextValue.value,
    important: parsedNextValue.important || matching.some((declaration) => declaration.important)
  });
  return serializeInlineStyle(next);
}
