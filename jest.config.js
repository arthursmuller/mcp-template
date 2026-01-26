/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  // Use the ESM preset for ts-jest
  preset: 'ts-jest/presets/default-esm', 
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts', '**/*.test.ts'],
  moduleNameMapper: {
    // This allows Jest to handle imports ending in .js (which TypeScript uses in ESM)
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    // Configure ts-jest to use ESM
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
};