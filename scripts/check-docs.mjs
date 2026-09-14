import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignored = new Set(['.git', '.artifacts', '.logs', '.stryker-tmp', 'node_modules', 'dist', 'coverage', 'playwright-report']);
async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.name.startsWith('test-results')) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(file));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(file);
  }
  return files;
}

let checked = 0;
const failures = [];
for (const file of await markdownFiles(root)) {
  const content = (await readFile(file, 'utf8')).replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
  for (const match of content.matchAll(/\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const link = match[1].replace(/^<|>$/g, '');
    if (/^[a-z][a-z\d+.-]*:/i.test(link) || link.startsWith('#')) continue;
    const target = decodeURIComponent(link.split('#')[0]);
    if (!target) continue;
    checked += 1;
    const exists = await stat(path.resolve(path.dirname(file), target)).then(() => true, () => false);
    if (!exists) failures.push(`${path.relative(root, file)}: missing ${link}`);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`${checked} local Markdown file links resolve. Fragment IDs and external URLs are not checked.`);
