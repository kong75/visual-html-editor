import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.gif', 'image/gif'], ['.html', 'text/html; charset=utf-8'],
  ['.jpeg', 'image/jpeg'], ['.jpg', 'image/jpeg'], ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.png', 'image/png'], ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'], ['.woff', 'font/woff'], ['.woff2', 'font/woff2']
]);

function send(response, status, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(body);
}

function inside(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function readRequest(request, limit = 20 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('The HTML file is larger than 20 MB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function serveFile(response, filePath) {
  const file = await stat(filePath).catch(() => null);
  if (!file?.isFile()) {
    send(response, 404, 'Not found.');
    return;
  }
  response.writeHead(200, {
    'Content-Type': contentTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  createReadStream(filePath).pipe(response);
}

export async function createLocalEditorServer({ filePath, profile = 'web', port = 0 } = {}) {
  if (!filePath) throw new Error('Provide an HTML file: npx @visual-html/editor ./document.html');
  if (!['email', 'slides', 'web'].includes(profile)) throw new Error('Profile must be email, slides, or web.');
  const absoluteFile = path.resolve(filePath);
  const file = await stat(absoluteFile).catch(() => null);
  if (!file?.isFile()) throw new Error(`HTML file not found: ${absoluteFile}`);
  if (!['.html', '.htm'].includes(path.extname(absoluteFile).toLowerCase())) throw new Error('Choose a .html or .htm file.');
  const documentRoot = path.dirname(absoluteFile);
  let origin = '';

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', origin || 'http://127.0.0.1');
      if (url.pathname === '/api/document' && request.method === 'GET') {
        const html = await readFile(absoluteFile, 'utf8');
        send(response, 200, JSON.stringify({ html, name: path.basename(absoluteFile), profile, baseUrl: `${origin}/project/` }), 'application/json; charset=utf-8');
        return;
      }
      if (url.pathname === '/api/document' && request.method === 'PUT') {
        const html = await readRequest(request);
        await writeFile(absoluteFile, html, 'utf8');
        send(response, 200, JSON.stringify({ saved: true }), 'application/json; charset=utf-8');
        return;
      }
      if (url.pathname.startsWith('/project/')) {
        const relative = decodeURIComponent(url.pathname.slice('/project/'.length));
        const assetPath = path.resolve(documentRoot, relative);
        if (!inside(documentRoot, assetPath)) {
          send(response, 403, 'Asset path is outside the document folder.');
          return;
        }
        await serveFile(response, assetPath);
        return;
      }
      const staticRelative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const staticPath = path.resolve(packageRoot, 'dist', staticRelative);
      if (!inside(path.join(packageRoot, 'dist'), staticPath)) {
        send(response, 403, 'Invalid path.');
        return;
      }
      await serveFile(response, staticPath);
    } catch (error) {
      send(response, error instanceof URIError ? 400 : 500, error instanceof Error ? error.message : 'Request failed.');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to determine the editor address.');
  origin = `http://127.0.0.1:${address.port}`;
  return { server, url: `${origin}/`, filePath: absoluteFile };
}

function openBrowser(url) {
  const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => undefined);
  child.unref();
}

function parseArguments(args) {
  let filePath;
  let profile = 'web';
  let port = 0;
  let shouldOpen = true;
  for (const argument of args) {
    if (argument === '--no-open') shouldOpen = false;
    else if (argument.startsWith('--profile=')) profile = argument.slice('--profile='.length);
    else if (argument.startsWith('--port=')) port = Number.parseInt(argument.slice('--port='.length), 10);
    else if (!argument.startsWith('-') && !filePath) filePath = argument;
    else throw new Error(`Unknown option: ${argument}`);
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port must be between 0 and 65535.');
  return { filePath, profile, port, shouldOpen };
}

export async function runCli(args) {
  const { shouldOpen, ...options } = parseArguments(args);
  const running = await createLocalEditorServer(options);
  process.stdout.write(`Visual HTML is editing ${running.filePath}\n${running.url}\nPress Ctrl+C to stop.\n`);
  if (shouldOpen) openBrowser(running.url);
  const close = () => running.server.close(() => process.exit(0));
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  return running;
}
