import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import semver from 'semver';

export const releaseManifestFiles = ['package.json', ...['core', 'deck', 'editor', 'react'].map((name) => `packages/${name}/package.json`)];

export async function prepareReleaseVersion(root, version) {
  if (version !== '--check' && semver.valid(version) !== version) {
    throw new Error('Expected an exact semantic version or --check.');
  }
  const manifests = await Promise.all(releaseManifestFiles.map(async (file) => ({ file, data: JSON.parse(await readFile(path.join(root, file), 'utf8')) })));
  const current = manifests[0].data.version;
  if (semver.valid(current) !== current || manifests.some(({ data }) => data.version !== current)) {
    throw new Error('Root and publishable packages must use the same valid version. Resolve the mismatch before preparing a release.');
  }
  if (version === '--check') return current;
  for (const { file, data } of manifests) {
    data.version = version;
    await writeFile(path.join(root, file), JSON.stringify(data, null, 2) + '\n');
  }
  return version;
}
