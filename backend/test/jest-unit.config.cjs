const path = require('node:path');
const { jest: projectConfig } = require('../package.json');

module.exports = {
  ...projectConfig,
  rootDir: path.resolve(__dirname, '../src'),
  setupFiles: projectConfig.setupFiles ?? [],
  testPathIgnorePatterns: [
    ...(projectConfig.testPathIgnorePatterns ?? []),
    '/auth/trusted-browser\\.service\\.spec\\.ts$',
    '/auth/two-factor\\.service\\.spec\\.ts$',
  ],
};
