import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reactMajor = process.env.VHE_TEST_REACT_MAJOR ?? '19';
if (!['18', '19'].includes(reactMajor)) throw new Error('VHE_TEST_REACT_MAJOR must be 18 or 19.');
const artifacts = path.join(root, '.artifacts', 'consumer-tests');
const tarballs = path.join(artifacts, 'tarballs');

function run(args, cwd = root) {
  const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm';
  const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'pnpm', ...args] : args;
  const result = spawnSync(command, commandArgs, { cwd, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

function fileDependency(filePath) {
  return `file:${filePath.replaceAll('\\', '/')}`;
}

await rm(artifacts, { recursive: true, force: true });
await mkdir(tarballs, { recursive: true });

for (const packageName of ['core', 'deck', 'editor', 'react']) {
  run(['--dir', path.join(root, 'packages', packageName), 'pack', '--pack-destination', tarballs]);
}

const packedFiles = await readdir(tarballs);
const resolveTarball = (packageName) => {
  const file = packedFiles.find((candidate) => candidate.startsWith(`visual-html-${packageName}-`) && candidate.endsWith('.tgz'));
  if (!file) throw new Error(`Missing packed @visual-html/${packageName} package.`);
  return path.join(tarballs, file);
};

const packed = {
  core: resolveTarball('core'),
  deck: resolveTarball('deck'),
  editor: resolveTarball('editor'),
  react: resolveTarball('react')
};

const budgets = { core: 60_000, deck: 50_000, editor: 850_000, react: 120_000 };
for (const [packageName, filePath] of Object.entries(packed)) {
  const size = (await stat(filePath)).size;
  const budget = budgets[packageName];
  process.stdout.write(`@visual-html/${packageName}: ${(size / 1024).toFixed(1)} KiB / ${(budget / 1024).toFixed(1)} KiB budget\n`);
  if (size > budget) throw new Error(`@visual-html/${packageName} exceeds its packed-size budget.`);
}

async function prepareConsumer(name, replacements) {
  const source = path.join(root, 'tests', 'consumers', name);
  const target = path.join(artifacts, name);
  await cp(source, target, { recursive: true });
  const packagePath = path.join(target, 'package.json');
  let packageJson = await readFile(packagePath, 'utf8');
  for (const [placeholder, value] of Object.entries(replacements)) {
    packageJson = packageJson.replaceAll(placeholder, value);
  }
  await writeFile(packagePath, packageJson);
  return target;
}

const headless = await prepareConsumer('headless', {
  '__CORE_TARBALL__': fileDependency(packed.core)
});
run(['install', '--ignore-workspace', '--no-frozen-lockfile'], headless);
run(['typecheck'], headless);
run(['start'], headless);

const reactVite = await prepareConsumer('react-vite', {
  '__CORE_TARBALL__': fileDependency(packed.core),
  '__DECK_TARBALL__': fileDependency(packed.deck),
  '__REACT_TARBALL__': fileDependency(packed.react),
  '__REACT_VERSION__': reactMajor === '18' ? '18.2.0' : '19.0.0',
  '__REACT_TYPES_VERSION__': reactMajor === '18' ? '^18.2.0' : '^19.0.0'
});
run(['install', '--ignore-workspace', '--no-frozen-lockfile'], reactVite);
run(['build'], reactVite);

const sourceReactVite = await prepareConsumer('source-react-vite', {
  '__CORE_TARBALL__': fileDependency(packed.core),
  '__EDITOR_TARBALL__': fileDependency(packed.editor),
  '__REACT_VERSION__': reactMajor === '18' ? '18.2.0' : '19.0.0',
  '__REACT_TYPES_VERSION__': reactMajor === '18' ? '^18.2.0' : '^19.0.0'
});
run(['install', '--ignore-workspace', '--no-frozen-lockfile'], sourceReactVite);
run(['exec', 'visual-html', 'init'], sourceReactVite);
run(['exec', 'visual-html', 'add', 'editor', '--no-install'], sourceReactVite);
run(['install', '--ignore-workspace', '--no-frozen-lockfile'], sourceReactVite);
run(['build'], sourceReactVite);

process.stdout.write('Packed consumer tests passed.\n');
