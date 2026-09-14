import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reactRoot = path.join(root, 'packages', 'react');
const sourceRoot = path.join(reactRoot, 'src');
const registryRoot = path.join(root, 'packages', 'editor', 'registry');
const editorRoot = path.join(registryRoot, 'editor');

const excludedFiles = new Set([
  'bundle.ts',
  'deck-navigator.tsx',
  'use-deck-snapshot.ts'
]);

async function collectFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path.join(directory, entry.name), relative));
    else if (!entry.name.includes('.test.') && !excludedFiles.has(relative)) files.push(relative);
  }
  return files.sort();
}

function registryIndex(source) {
  const exports = source
    .split(/\r?\n/)
    .filter((line) => !line.includes('DeckNavigator') && !line.includes('useDeckSnapshot'))
    .join('\n')
    .trimStart();
  return `import './styles.css';\n\n${exports}`;
}

function digest(source) {
  return createHash('sha256').update(source).digest('hex');
}

function normalizeText(source) {
  return source.replaceAll('\r\n', '\n').replace(/\n*$/, '\n');
}

const reactPackage = JSON.parse(await readFile(path.join(reactRoot, 'package.json'), 'utf8'));
const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const files = [...await collectFiles(sourceRoot), 'LICENSE.visual-html', 'styles.css.d.ts'].sort();

if (path.resolve(registryRoot) !== path.join(root, 'packages', 'editor', 'registry')) {
  throw new Error('Refusing to rebuild a registry outside packages/editor/registry.');
}
await rm(registryRoot, { recursive: true, force: true });
await mkdir(editorRoot, { recursive: true });

const hashes = {};
for (const relative of files) {
  const sourcePath = path.join(sourceRoot, ...relative.split('/'));
  const targetPath = path.join(editorRoot, ...relative.split('/'));
  await mkdir(path.dirname(targetPath), { recursive: true });
  if (relative === 'LICENSE.visual-html') {
    const source = normalizeText(await readFile(path.join(root, 'LICENSE'), 'utf8'));
    await writeFile(targetPath, source, 'utf8');
    hashes[relative] = digest(source);
  } else if (relative === 'styles.css.d.ts') {
    const source = 'export {};\n';
    await writeFile(targetPath, source, 'utf8');
    hashes[relative] = digest(source);
  } else if (relative === 'index.ts') {
    const source = registryIndex(await readFile(sourcePath, 'utf8'));
    await writeFile(targetPath, source, 'utf8');
    hashes[relative] = digest(source);
  } else {
    const source = normalizeText(await readFile(sourcePath, 'utf8'));
    await writeFile(targetPath, source, 'utf8');
    hashes[relative] = digest(source);
  }
}

const dependencyNames = ['@base-ui/react', '@visual-html/core', 'lucide-react'];
const dependencies = Object.fromEntries(dependencyNames.map((name) => {
  const declared = reactPackage.dependencies[name];
  const version = declared === 'workspace:*' ? `^${rootPackage.version}` : declared;
  return [name, version];
}));

const manifest = {
  schemaVersion: 1,
  name: 'editor',
  description: 'Editable React source for the Visual HTML workspace.',
  registryVersion: rootPackage.version,
  dependencies,
  files,
  hashes
};
await writeFile(path.join(registryRoot, 'editor.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`Built source registry item "editor" with ${files.length} files.\n`);
