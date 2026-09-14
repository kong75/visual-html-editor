import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { addRegistryItem, diffRegistryItem, initProject, updateRegistryItem } from '../bin/visual-html-registry.mjs';

async function project(t) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'visual-html-registry-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(path.join(cwd, 'package.json'), `${JSON.stringify({
    name: 'registry-consumer',
    private: true,
    dependencies: { '@visual-html/core': 'file:../core.tgz' }
  }, null, 2)}\n`);
  return cwd;
}

test('initializes and adds editable editor source without deck-only modules', async (t) => {
  const cwd = await project(t);
  const initialized = await initProject({ cwd });
  assert.equal(initialized.created, true);
  const result = await addRegistryItem({ cwd, install: false });

  assert.ok(result.copied.length > 30);
  const sourceRoot = path.join(cwd, 'src', 'components', 'visual-html-editor');
  const index = await readFile(path.join(sourceRoot, 'index.ts'), 'utf8');
  assert.match(index, /^import '\.\/styles\.css';/);
  assert.match(index, /VisualHtmlEditor/);
  assert.match(await readFile(path.join(sourceRoot, 'LICENSE.visual-html'), 'utf8'), /MIT License/);
  await assert.rejects(readFile(path.join(sourceRoot, 'deck-navigator.tsx')), /ENOENT/);

  const packageJson = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8'));
  assert.equal(packageJson.dependencies['@visual-html/core'], 'file:../core.tgz');
  assert.match(packageJson.dependencies['@base-ui/react'], /^\^/);
  assert.match(packageJson.dependencies['lucide-react'], /^\^/);
  assert.equal(packageJson.dependencies['@visual-html/deck'], undefined);
  assert.ok(await readFile(path.join(cwd, '.visual-html', 'registry-lock.json'), 'utf8'));
});

test('diff and update preserve locally modified files', async (t) => {
  const cwd = await project(t);
  await initProject({ cwd, sourcePath: 'src/editor' });
  await addRegistryItem({ cwd, install: false });
  assert.equal((await diffRegistryItem({ cwd })).every(({ status }) => status === 'clean'), true);

  const toolbarPath = path.join(cwd, 'src', 'editor', 'workspace', 'toolbar.tsx');
  const customized = `${await readFile(toolbarPath, 'utf8')}\n// Consumer customization.\n`;
  await writeFile(toolbarPath, customized);
  const changes = await diffRegistryItem({ cwd });
  assert.equal(changes.find(({ file }) => file === 'workspace/toolbar.tsx')?.status, 'modified');

  const update = await updateRegistryItem({ cwd });
  assert.deepEqual(update.preserved, ['workspace/toolbar.tsx']);
  assert.equal(await readFile(toolbarPath, 'utf8'), customized);
});

test('add refuses to overwrite untracked consumer files by default', async (t) => {
  const cwd = await project(t);
  await initProject({ cwd, sourcePath: 'src/editor' });
  const target = path.join(cwd, 'src', 'editor', 'index.ts');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, 'export const ownedByConsumer = true;\n');
  await assert.rejects(addRegistryItem({ cwd, install: false }), /Refusing to overwrite/);
  assert.equal(await readFile(target, 'utf8'), 'export const ownedByConsumer = true;\n');
});
