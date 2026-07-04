// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],

  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['./src/tests/setup.ts'],
};
