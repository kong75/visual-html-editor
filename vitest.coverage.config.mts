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
        statements: 45,
        branches: 38,
        functions: 47,
        lines: 46,
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
          statements: 4,
          branches: 1,
          functions: 5,
          lines: 4
        }
      }
    }
  }
});
