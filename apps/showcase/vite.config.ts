import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/',
  optimizeDeps: {
    entries: [path.resolve(root, 'index.html')]
  },
  resolve: {
    alias: [
      {
        find: /^@visual-html\/react\/styles\.css$/,
        replacement: path.resolve(root, '../../packages/react/src/styles.css')
      },
      {
        find: /^@visual-html\/core$/,
        replacement: path.resolve(root, '../../packages/core/src/index.ts')
      },
      {
        find: /^@visual-html\/deck$/,
        replacement: path.resolve(root, '../../packages/deck/src/index.ts')
      },
      {
        find: /^@visual-html\/react$/,
        replacement: path.resolve(root, '../../packages/react/src/index.ts')
      }
    ]
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true
  }
});
