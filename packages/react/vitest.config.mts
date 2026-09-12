import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@visual-html/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@visual-html/deck': fileURLToPath(new URL('../deck/src/index.ts', import.meta.url))
    }
  }
});
