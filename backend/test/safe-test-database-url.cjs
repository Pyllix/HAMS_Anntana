const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const TEST_DATABASE_NAME_TOKEN = /(?:^|[^a-z0-9])test(?:$|[^a-z0-9])/i;

function validateTestDatabaseUrl(value) {
  if (!value) {
    throw new Error(
      'TEST_DATABASE_URL is required; DATABASE_URL is never used as a test fallback.',
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (!POSTGRES_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error('TEST_DATABASE_URL must use the PostgreSQL protocol.');
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
  } catch {
    throw new Error('TEST_DATABASE_URL must include a valid database name.');
  }

  if (!parsedUrl.hostname || !databaseName || databaseName.includes('/')) {
    throw new Error('TEST_DATABASE_URL must include a host and database name.');
  }

  if (!TEST_DATABASE_NAME_TOKEN.test(databaseName)) {
    throw new Error(
      'TEST_DATABASE_URL must name a dedicated test database (the database name must contain a standalone "test" token).',
    );
  }

  return value;
}

module.exports = { validateTestDatabaseUrl };
