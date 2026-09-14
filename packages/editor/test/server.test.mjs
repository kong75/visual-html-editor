import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createLocalEditorServer } from '../bin/visual-html-server.mjs';

test('serves, resolves assets for, and explicitly saves one local HTML file', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'visual-html-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const htmlPath = path.join(directory, 'lesson.html');
  await writeFile(htmlPath, '<h1>Lesson</h1><img src="cover.svg">');
  await writeFile(path.join(directory, 'cover.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const running = await createLocalEditorServer({ filePath: htmlPath, profile: 'web' });
  t.after(() => new Promise((resolve) => running.server.close(resolve)));

  const loaded = await fetch(`${running.url}api/document`).then((response) => response.json());
  assert.equal(loaded.name, 'lesson.html');
  assert.equal(loaded.html, '<h1>Lesson</h1><img src="cover.svg">');
  assert.equal(loaded.baseUrl, `${running.url}project/`);
  assert.equal(await fetch(`${running.url}project/cover.svg`).then((response) => response.text()), '<svg xmlns="http://www.w3.org/2000/svg"/>');

  const saved = '<h1>Updated lesson</h1>';
  const response = await fetch(`${running.url}api/document`, { method: 'PUT', body: saved });
  assert.equal(response.status, 200);
  assert.equal(await readFile(htmlPath, 'utf8'), saved);
});

test('validates file and profile inputs', async () => {
  await assert.rejects(createLocalEditorServer(), /Provide an HTML file/);
  await assert.rejects(createLocalEditorServer({ filePath: 'missing.html' }), /not found/);
});
