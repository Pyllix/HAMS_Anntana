require('dotenv').config({ quiet: true });

const { validateTestDatabaseUrl } = require('./safe-test-database-url.cjs');

process.env.DATABASE_URL = validateTestDatabaseUrl(
  process.env.TEST_DATABASE_URL,
  process.env.DATABASE_URL,
);
