import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultRegistryRoot = path.join(packageRoot, 'registry');
const configName = 'visual-html.json';
const lockName = path.join('.visual-html', 'registry-lock.json');

function inside(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function projectPath(cwd, relative, label) {
  if (typeof relative !== 'string' || relative.trim() === '' || path.isAbsolute(relative)) {
    throw new Error(`${label} must be a non-empty project-relative path.`);
  }
  const resolved = path.resolve(cwd, relative);
  if (!inside(cwd, resolved) || resolved === path.resolve(cwd)) {
    throw new Error(`${label} must stay inside the project directory.`);
  }
  return resolved;
}

function digest(source) {
  return createHash('sha256').update(source).digest('hex');
}

async function exists(filePath) {
  return Boolean(await stat(filePath).catch(() => null));
}

async function readJson(filePath, fallback) {
  if (!await exists(filePath)) return fallback;
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    throw new Error(`Unable to parse ${filePath}.`);
  }
}

async function readManifest(registryRoot, name) {
  const manifestPath = path.join(registryRoot, `${name}.json`);
  const manifest = await readJson(manifestPath, null);
  if (!manifest || manifest.schemaVersion !== 1 || manifest.name !== name || !Array.isArray(manifest.files)) {
    throw new Error(`Unknown registry item: ${name}`);
  }
  return manifest;
}

async function readProjectConfig(cwd) {
  const configPath = path.join(cwd, configName);
  const config = await readJson(configPath, null);
  if (!config) throw new Error(`Run "visual-html init" before adding source components.`);
  if (config.schemaVersion !== 1 || typeof config.sourcePath !== 'string') {
    throw new Error(`${configName} is not a supported Visual HTML configuration.`);
  }
  return config;
}

async function hashFile(filePath) {
  if (!await exists(filePath)) return null;
  return digest(await readFile(filePath));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function initProject({ cwd = process.cwd(), sourcePath = 'src/components/visual-html-editor', force = false } = {}) {
  cwd = path.resolve(cwd);
  const packagePath = path.join(cwd, 'package.json');
  if (!await exists(packagePath)) throw new Error(`No package.json found in ${cwd}.`);
  projectPath(cwd, sourcePath, 'Source path');
  const configPath = path.join(cwd, configName);
  if (await exists(configPath) && !force) {
    const current = await readProjectConfig(cwd);
    return { config: current, configPath, created: false };
  }
  const config = { schemaVersion: 1, sourcePath: sourcePath.replaceAll('\\', '/') };
  await writeJson(configPath, config);
  return { config, configPath, created: true };
}

async function ensureDependencies(cwd, dependencies) {
  const packagePath = path.join(cwd, 'package.json');
  const packageJson = await readJson(packagePath, null);
  if (!packageJson) throw new Error(`No package.json found in ${cwd}.`);
  packageJson.dependencies ??= {};
  const added = {};
  for (const [name, version] of Object.entries(dependencies ?? {})) {
    if (packageJson.dependencies[name] || packageJson.devDependencies?.[name]) continue;
    packageJson.dependencies[name] = version;
    added[name] = version;
  }
  if (Object.keys(added).length > 0) await writeJson(packagePath, packageJson);
  return added;
}

async function packageManager(cwd) {
  const candidates = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun']
  ];
  for (const [lockfile, manager] of candidates) {
    if (await exists(path.join(cwd, lockfile))) return manager;
  }
  return 'npm';
}

async function installDependencies(cwd, dependencies) {
  const specs = Object.entries(dependencies).map(([name, version]) => `${name}@${version}`);
  if (specs.length === 0) return null;
  const manager = await packageManager(cwd);
  const executable = process.platform === 'win32' ? `${manager}.cmd` : manager;
  const args = manager === 'npm' ? ['install', ...specs] : ['add', ...specs];
  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${manager} exited with code ${code}.`)));
  });
  return manager;
}

function itemPaths({ cwd, config, registryRoot, name, relative }) {
  const sourceRoot = path.join(registryRoot, name);
  const targetRoot = projectPath(cwd, config.sourcePath, 'Configured source path');
  const source = path.resolve(sourceRoot, ...relative.split('/'));
  const target = path.resolve(targetRoot, ...relative.split('/'));
  if (!inside(sourceRoot, source) || !inside(targetRoot, target)) throw new Error(`Invalid registry file path: ${relative}`);
  return { source, target, targetRoot };
}

async function readLock(cwd) {
  return readJson(path.join(cwd, lockName), { schemaVersion: 1, items: {} });
}

async function writeLock(cwd, lock) {
  await writeJson(path.join(cwd, lockName), lock);
}

export async function addRegistryItem({
  cwd = process.cwd(), name = 'editor', overwrite = false, install = true, registryRoot = defaultRegistryRoot
} = {}) {
  cwd = path.resolve(cwd);
  const config = await readProjectConfig(cwd);
  const manifest = await readManifest(registryRoot, name);
  const plans = [];
  const conflicts = [];
  for (const relative of manifest.files) {
    const paths = itemPaths({ cwd, config, registryRoot, name, relative });
    const source = await readFile(paths.source);
    const currentHash = await hashFile(paths.target);
    const sourceHash = digest(source);
    if (currentHash && currentHash !== sourceHash && !overwrite) conflicts.push(relative);
    plans.push({ ...paths, relative, source, sourceHash, currentHash });
  }
  if (conflicts.length > 0) {
    throw new Error(`Refusing to overwrite ${conflicts.length} existing file${conflicts.length === 1 ? '' : 's'}:\n${conflicts.map((file) => `  ${file}`).join('\n')}\nUse "visual-html update ${name}" to preserve local changes, or pass --overwrite.`);
  }
  for (const plan of plans) {
    await mkdir(path.dirname(plan.target), { recursive: true });
    if (plan.currentHash !== plan.sourceHash) await writeFile(plan.target, plan.source);
  }
  const lock = await readLock(cwd);
  lock.items[name] = {
    registryVersion: manifest.registryVersion,
    sourcePath: config.sourcePath,
    files: Object.fromEntries(plans.map((plan) => [plan.relative, plan.sourceHash]))
  };
  await writeLock(cwd, lock);
  const addedDependencies = await ensureDependencies(cwd, manifest.dependencies);
  const manager = install ? await installDependencies(cwd, addedDependencies) : null;
  return { copied: plans.filter((plan) => plan.currentHash !== plan.sourceHash).map((plan) => plan.relative), addedDependencies, manager, targetRoot: plans[0]?.targetRoot };
}

export async function diffRegistryItem({ cwd = process.cwd(), name = 'editor', registryRoot = defaultRegistryRoot } = {}) {
  cwd = path.resolve(cwd);
  const config = await readProjectConfig(cwd);
  const manifest = await readManifest(registryRoot, name);
  const lock = await readLock(cwd);
  const installed = lock.items[name];
  if (!installed) throw new Error(`Registry item "${name}" is not installed.`);
  const files = new Set([...Object.keys(installed.files), ...manifest.files]);
  const changes = [];
  for (const relative of [...files].sort()) {
    const { source, target } = itemPaths({ cwd, config, registryRoot, name, relative });
    const baseHash = installed.files[relative] ?? null;
    const sourceHash = manifest.files.includes(relative) ? await hashFile(source) : null;
    const targetHash = await hashFile(target);
    let status = 'clean';
    if (!sourceHash) status = 'removed-upstream';
    else if (!targetHash) status = 'missing';
    else if (targetHash !== baseHash && sourceHash !== baseHash && targetHash !== sourceHash) status = 'conflict';
    else if (targetHash !== baseHash && targetHash !== sourceHash) status = 'modified';
    else if (sourceHash !== baseHash && targetHash !== sourceHash) status = 'update-available';
    changes.push({ file: relative, status });
  }
  return changes;
}

export async function updateRegistryItem({ cwd = process.cwd(), name = 'editor', registryRoot = defaultRegistryRoot } = {}) {
  cwd = path.resolve(cwd);
  const config = await readProjectConfig(cwd);
  const manifest = await readManifest(registryRoot, name);
  const lock = await readLock(cwd);
  const installed = lock.items[name];
  if (!installed) throw new Error(`Registry item "${name}" is not installed.`);
  const updated = [];
  const preserved = [];
  const nextFiles = { ...installed.files };
  for (const relative of manifest.files) {
    const { source, target } = itemPaths({ cwd, config, registryRoot, name, relative });
    const sourceContent = await readFile(source);
    const sourceHash = digest(sourceContent);
    const targetHash = await hashFile(target);
    const baseHash = installed.files[relative] ?? null;
    if (targetHash === sourceHash) {
      nextFiles[relative] = sourceHash;
      continue;
    }
    if ((baseHash && targetHash === baseHash) || (!baseHash && !targetHash)) {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, sourceContent);
      nextFiles[relative] = sourceHash;
      updated.push(relative);
    } else {
      preserved.push(relative);
    }
  }
  installed.registryVersion = manifest.registryVersion;
  installed.sourcePath = config.sourcePath;
  installed.files = nextFiles;
  await writeLock(cwd, lock);
  const addedDependencies = await ensureDependencies(cwd, manifest.dependencies);
  return { updated, preserved, addedDependencies };
}

function parseOptions(args) {
  const options = { install: true };
  const positional = [];
  for (const argument of args) {
    if (argument === '--overwrite') options.overwrite = true;
    else if (argument === '--force') options.force = true;
    else if (argument === '--no-install') options.install = false;
    else if (argument.startsWith('--path=')) options.sourcePath = argument.slice('--path='.length);
    else if (argument.startsWith('-')) throw new Error(`Unknown option: ${argument}`);
    else positional.push(argument);
  }
  return { options, positional };
}

export function registryHelp() {
  return `Visual HTML\n\nSource installation:\n  visual-html init [--path=src/components/visual-html-editor]\n  visual-html add editor [--no-install] [--overwrite]\n  visual-html diff editor\n  visual-html update editor\n\nLocal file editor:\n  visual-html ./document.html [--profile=web] [--port=4173] [--no-open]\n`;
}

export async function runRegistryCli(args, { cwd = process.cwd() } = {}) {
  const command = args[0];
  const { options, positional } = parseOptions(args.slice(1));
  if (command === 'init') {
    if (positional.length) throw new Error('The init command does not accept a component name.');
    const result = await initProject({ cwd, sourcePath: options.sourcePath, force: options.force });
    process.stdout.write(result.created ? `Created ${configName}.\n` : `${configName} already exists.\n`);
    return result;
  }
  const name = positional[0] ?? 'editor';
  if (positional.length > 1) throw new Error(`Unexpected argument: ${positional[1]}`);
  if (command === 'add') {
    const result = await addRegistryItem({ cwd, name, overwrite: options.overwrite, install: options.install });
    process.stdout.write(`Added ${name} source to ${path.relative(cwd, result.targetRoot)} (${result.copied.length} files).\n`);
    if (!options.install && Object.keys(result.addedDependencies).length) process.stdout.write('Dependencies were added to package.json; run your package manager install.\n');
    return result;
  }
  if (command === 'diff') {
    const changes = await diffRegistryItem({ cwd, name });
    const visible = changes.filter(({ status }) => status !== 'clean');
    process.stdout.write(visible.length ? `${visible.map(({ status, file }) => `${status.padEnd(18)} ${file}`).join('\n')}\n` : `${name} is up to date.\n`);
    return changes;
  }
  if (command === 'update') {
    const result = await updateRegistryItem({ cwd, name });
    process.stdout.write(`Updated ${result.updated.length} file${result.updated.length === 1 ? '' : 's'}; preserved ${result.preserved.length} locally modified file${result.preserved.length === 1 ? '' : 's'}.\n`);
    return result;
  }
  throw new Error(`Unknown source command: ${command}`);
}
