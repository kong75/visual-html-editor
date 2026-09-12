import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareReleaseVersion } from './release-manifests.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];
if (process.argv.length !== 3) {
  throw new Error('Usage: node scripts/release-version.mjs <exact-semver | --check>');
}
const prepared = await prepareReleaseVersion(root, version);
if (version === '--check') {
  console.log(`All release manifests use ${prepared}.`);
} else {
  console.log(`Prepared ${version} in the root and three package manifests. Update CHANGELOG.md, run pnpm install --lockfile-only, and review the diff. Nothing was published or tagged.`);
}
