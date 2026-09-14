import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@visual-html/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@visual-html/deck': fileURLToPath(new URL('./packages/deck/src/index.ts', import.meta.url))
    }
  },
  test: {
    include: [
      'packages/core/src/**/*.test.ts',
      'packages/deck/src/**/*.test.ts',
      'packages/react/src/**/*.test.tsx',
      'tests/unit/**/*.test.ts'
    ],
    environment: 'node',
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      include: [
        'packages/core/src/**/*.ts',
        'packages/deck/src/**/*.ts',
        'packages/react/src/use-html-editor.ts'
      ],
      exclude: [
        'packages/**/src/**/*.test.ts',
        'packages/**/src/**/*.test.tsx',
        'packages/**/src/index.ts',
        'packages/**/src/types.ts'
      ],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 95,
        lines: 92
      }
    }
  }
});
