import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(root, 'src/bundle.ts'),
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'styles'
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', '@visual-html/core', '@visual-html/deck', 'lucide-react', /^@base-ui\/react/]
    }
  }
});
