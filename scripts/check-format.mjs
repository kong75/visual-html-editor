import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const checkedExtensions = new Set([
  '.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.mts', '.svg', '.ts', '.tsx', '.yaml', '.yml'
]);
const ignoredSegments = new Set(['.artifacts', 'coverage', 'dist', 'node_modules']);
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => checkedExtensions.has(path.extname(file)))
  .filter((file) => !file.split('/').some((segment) => ignoredSegments.has(segment)))
  .filter((file) => !file.startsWith('test-results'));
const failures = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const normalized = source.replace(/\r\n/g, '\n');
  if (normalized.charCodeAt(0) === 0xfeff) failures.push(`${file}: remove the UTF-8 byte-order mark`);
  if (!normalized.endsWith('\n')) failures.push(`${file}: add a final newline`);
  if (path.extname(file) !== '.md' && /[ \t]+$/m.test(normalized)) failures.push(`${file}: remove trailing whitespace`);
  if (/^\t+/m.test(normalized)) failures.push(`${file}: indent with spaces, not tabs`);
}

if (failures.length > 0) {
  console.error(`Formatting check failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Formatting check passed for ${files.length} text files.`);
}
