/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  // Sources import siblings as "./x.js" (required by the browser); map those back to the .ts files.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.ts$': ['@swc/jest', { jsc: { target: 'es2022', parser: { syntax: 'typescript' } }, module: { type: 'commonjs' } }],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main/main.ts', '!src/main/preload.ts', '!src/**/*.d.ts'],
};
