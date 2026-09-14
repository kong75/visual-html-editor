import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotPackageApi } from './public-api.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const update = process.argv.includes('--update');
const packages = ['core', 'deck', 'react'];
let failed = false;

await mkdir(path.join(root, 'api'), { recursive: true });

for (const packageName of packages) {
  const snapshotPath = path.join(root, 'api', `${packageName}.d.ts`);
  const declaration = await snapshotPackageApi(path.join(root, 'packages', packageName));

  if (update) {
    await writeFile(snapshotPath, declaration);
    process.stdout.write(`Updated api/${packageName}.d.ts\n`);
    continue;
  }

  let snapshot = '';
  try {
    snapshot = (await readFile(snapshotPath, 'utf8')).replaceAll('\r\n', '\n');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    process.stderr.write(`Missing API snapshot: api/${packageName}.d.ts\n`);
    failed = true;
    continue;
  }

  if (snapshot !== declaration) {
    process.stderr.write(`Public API changed for @visual-html/${packageName}. Run pnpm api:update and review the diff.\n`);
    failed = true;
  }
}

if (failed) process.exit(1);
process.stdout.write('Public API snapshots match.\n');
