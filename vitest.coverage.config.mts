import { defineConfig } from 'vitest/config';

export default defineConfig({
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
