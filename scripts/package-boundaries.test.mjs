import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parse } from '@babel/parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('showcase imports workspace packages through their public entry points', async () => {
  const sourceRoot = path.join(root, 'apps', 'showcase', 'src');
  const packagesRoot = path.join(root, 'packages') + path.sep;
  for (const file of await readdir(sourceRoot, { recursive: true })) {
    if (!/\.tsx?$/.test(file)) continue;
    const absolute = path.join(sourceRoot, file);
    const ast = parse(await readFile(absolute, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    for (const statement of ast.program.body) {
      if (!['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(statement.type)) continue;
      const specifier = statement.source?.value;
      if (!specifier) continue;
      if (specifier.startsWith('.')) {
        assert.equal(path.resolve(path.dirname(absolute), specifier).startsWith(packagesRoot), false,
          `${file} reaches into a workspace package: ${specifier}`);
      } else if (specifier.startsWith('@visual-html/')) {
        const [, name, ...subpath] = specifier.split('/');
        const manifest = JSON.parse(await readFile(path.join(packagesRoot, name, 'package.json'), 'utf8'));
        const entry = subpath.length ? `./${subpath.join('/')}` : '.';
        assert.ok(Object.hasOwn(manifest.exports ?? {}, entry), `${file} imports an unexported entry: ${specifier}`);
      }
    }
  }
});

test('publishable packages do not include showcase samples', async () => {
  for (const name of ['core', 'deck', 'editor', 'react']) {
    const manifest = JSON.parse(await readFile(path.join(root, 'packages', name, 'package.json'), 'utf8'));
    const published = manifest.files ?? [];
    assert.equal(published.some((entry) => /sample|showcase|demo/i.test(entry)), false, `@visual-html/${name} publishes demo content`);
  }
  const samples = await readFile(path.join(root, 'apps', 'showcase', 'src', 'samples.ts'), 'utf8');
  assert.match(samples, /showcaseProfiles/);
});
