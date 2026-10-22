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
      'packages/react/src/**/*.test.{ts,tsx}',
      'tests/unit/**/*.test.ts'
    ],
    environment: 'node',
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      include: [
        'packages/core/src/**/*.ts',
        'packages/deck/src/**/*.ts',
        'packages/react/src/**/*.ts',
        'packages/react/src/**/*.tsx'
      ],
      exclude: [
        'packages/**/src/**/*.test.ts',
        'packages/**/src/**/*.test.tsx',
        'packages/**/src/index.ts',
        'packages/**/src/types.ts'
      ],
      thresholds: {
        statements: 53,
        branches: 45,
        functions: 52,
        lines: 55,
        'packages/core/src/**': {
          statements: 90,
          branches: 80,
          functions: 95,
          lines: 92
        },
        'packages/deck/src/**': {
          statements: 95,
          branches: 85,
          functions: 95,
          lines: 95
        },
        'packages/react/src/**': {
          statements: 20,
          branches: 15,
          functions: 17,
          lines: 21
        },
        'packages/react/src/canvas/selection.ts': {
          statements: 90,
          branches: 80,
          functions: 100,
          lines: 95
        },
        'packages/react/src/canvas/text-edit-history.ts': {
          statements: 95,
          branches: 85,
          functions: 100,
          lines: 95
        }
      }
    }
  }
});
