import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tarballs = path.join(root, '.artifacts', 'consumer-tests', 'tarballs');
const target = path.join(root, '.artifacts', 'runtime-consumer');
const files = await readdir(tarballs);
const dependencies = {};
for (const name of ['core', 'deck']) {
  const matches = files.filter((file) => file.startsWith(`visual-html-${name}-`) && file.endsWith('.tgz'));
  if (matches.length !== 1) throw new Error(`Expected exactly one packed @visual-html/${name} tarball.`);
  dependencies[`@visual-html/${name}`] = `file:${path.join(tarballs, matches[0]).replaceAll('\\', '/')}`;
}
// This fixed output lives under the workspace; never accept an arbitrary cleanup path.
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(path.join(root, 'tests', 'consumers', 'runtime', 'index.mjs'), path.join(target, 'index.mjs'));
await writeFile(path.join(target, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies }, null, 2));

function run(command, args) {
  const windowsNpm = process.platform === 'win32' && command === 'npm';
  const result = spawnSync(windowsNpm ? (process.env.ComSpec ?? 'cmd.exe') : command,
    windowsNpm ? ['/d', '/s', '/c', 'npm', ...args] : args,
    { cwd: target, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}.`);
}
run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--engine-strict']);
run(process.execPath, ['index.mjs']);
const manifest = JSON.parse(await readFile(path.join(target, 'package.json'), 'utf8'));
console.log(`Packed runtime consumers passed on ${process.version}: ${Object.keys(manifest.dependencies).join(', ')}.`);
