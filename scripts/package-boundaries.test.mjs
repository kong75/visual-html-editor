import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('publishable packages do not include showcase samples', async () => {
  for (const name of ['core', 'deck', 'editor', 'react']) {
    const manifest = JSON.parse(await readFile(path.join(root, 'packages', name, 'package.json'), 'utf8'));
    const published = manifest.files ?? [];
    assert.equal(published.some((entry) => /sample|showcase|demo/i.test(entry)), false, `@visual-html/${name} publishes demo content`);
  }
  const samples = await readFile(path.join(root, 'apps', 'showcase', 'src', 'samples.ts'), 'utf8');
  assert.match(samples, /showcaseProfiles/);
});
