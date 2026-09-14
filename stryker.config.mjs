/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  plugins: ['@stryker-mutator/vitest-runner'],
  testRunner: 'vitest',
  mutate: [
    'packages/core/src/patcher.ts',
    'packages/core/src/security.ts',
    'packages/core/src/runtime-security.ts'
  ],
  vitest: {
    configFile: 'vitest.mutation.config.mts',
    related: false
  },
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress'],
  thresholds: {
    high: 85,
    low: 80,
    break: 80
  },
  concurrency: 4,
  tempDirName: '.stryker-tmp'
};
