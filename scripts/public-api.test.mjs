import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { snapshotPackageApi } from './public-api.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'visual-html-api-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (file, text) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), text);
  };
  await put('package.json', JSON.stringify({ name: 'fixture', exports: { '.': { types: './dist/index.d.ts' }, './adapter': { types: './dist/adapter.d.ts' } } }));
  await put('dist/index.d.ts', "export { Controller } from './controller.js';\n");
  await put('dist/controller.d.ts', "import type { Result } from './types.js';\nexport declare class Controller { run(): Result; }\n");
  await put('dist/types.d.ts', 'export interface Result { value: string; }\n');
  await put('dist/adapter.d.ts', 'export declare function adapt(): boolean;\n');
  return { root, put };
}

test('detects signature changes behind unchanged re-exports and imported return types', async (t) => {
  const { root, put } = await fixture(t);
  const before = await snapshotPackageApi(root);
  await put('dist/types.d.ts', 'export interface Result { value: number; }\n');
  assert.notEqual(await snapshotPackageApi(root), before);
});

test('covers subpaths and import types, handles cycles, excludes unreachable declarations', async (t) => {
  const { root, put } = await fixture(t);
  await put('dist/adapter.d.ts', "export type Adapter = import('./types.js').Result;\n");
  await put('dist/types.d.ts', "export interface Result { value: import('./controller.js').Controller; }\n");
  await put('dist/private.d.ts', 'export type Hidden = string;\n');
  const snapshot = await snapshotPackageApi(root);
  assert.match(snapshot, /Entry \.\/adapter/);
  assert.match(snapshot, /File: dist\/types.d.ts/);
  assert.doesNotMatch(snapshot, /Hidden/);
  assert.equal(await snapshotPackageApi(root), snapshot);
});

test('rejects missing reachable declarations and references outside the package', async (t) => {
  const { root, put } = await fixture(t);
  await put('dist/types.d.ts', "export { Missing } from './missing.js';\n");
  await assert.rejects(snapshotPackageApi(root), /ENOENT/);
  await put('dist/types.d.ts', "export { Outside } from '../../outside.js';\n");
  await assert.rejects(snapshotPackageApi(root), /escapes package/);
});
