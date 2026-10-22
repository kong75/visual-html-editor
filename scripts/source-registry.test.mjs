import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registryIndex } from './source-registry.mjs';

const excludedModules = new Set(['./deck-navigator.js', './use-deck-snapshot.js']);

test('registry entry removes multiline value and type exports from omitted modules', () => {
  const source = [
    'export {',
    '  DeckNavigator as Navigator,',
    "} from './deck-navigator.js';",
    'export type {',
    '  DeckNavigatorProps,',
    "} from './deck-navigator.js';",
    "export { HtmlEditor } from './html-editor.js';",
    ''
  ].join('\r\n');
  assert.equal(registryIndex(source, excludedModules), "import './styles.css';\n\nexport { HtmlEditor } from './html-editor.js';\n");
});

test('registry entry preserves neighboring exports on the same line', () => {
  const source = "export { HtmlEditor } from './html-editor.js'; export * from './use-deck-snapshot.js'; export * as Deck from './deck-navigator.js';\n";
  assert.equal(registryIndex(source, excludedModules), "import './styles.css';\n\nexport { HtmlEditor } from './html-editor.js';  \n");
});

test('registry entry retains matching names and comments from included modules', () => {
  const source = [
    '// DeckNavigator is omitted from this entry.',
    "export { HtmlEditor as DeckNavigator } from './html-editor.js';",
    "export const description = 'useDeckSnapshot';",
    ''
  ].join('\n');
  assert.equal(registryIndex(source, excludedModules), `import './styles.css';\n\n${source}`);
});
