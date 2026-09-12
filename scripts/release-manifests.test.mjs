import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { prepareReleaseVersion, releaseManifestFiles } from './release-manifests.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'visual-html-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const file of releaseManifestFiles) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), JSON.stringify({ version: '0.1.0', private: file === 'package.json' }));
  }
  const contents = () => Promise.all(releaseManifestFiles.map((file) => readFile(path.join(root, file), 'utf8')));
  return { root, contents };
}

test('prepares a coordinated prerelease without changing package visibility', async (t) => {
  const { root, contents } = await fixture(t);
  const before = await contents();
  await prepareReleaseVersion(root, '--check');
  assert.deepEqual(await contents(), before);
  await prepareReleaseVersion(root, '0.1.0-alpha.1');
  (await contents()).map(JSON.parse).forEach((manifest, index) => {
    assert.equal(manifest.version, '0.1.0-alpha.1');
    assert.equal(manifest.private, index === 0);
  });
});

test('rejects invalid versions and inconsistent manifests before writing anything', async (t) => {
  const { root, contents } = await fixture(t);
  const before = await contents();
  await assert.rejects(prepareReleaseVersion(root, 'v1.2.3'), /exact semantic version/);
  assert.deepEqual(await contents(), before);
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '0.2.0', private: true }));
  const inconsistent = await contents();
  await assert.rejects(prepareReleaseVersion(root, '0.3.0'), /same valid version/);
  assert.deepEqual(await contents(), inconsistent);
});
