import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/core/src/**/*.test.ts',
      'tests/unit/security-policy.test.ts'
    ],
    environment: 'node',
    testTimeout: 10_000
  }
});
