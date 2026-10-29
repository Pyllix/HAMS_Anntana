const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const TEST_DATABASE_NAME_TOKEN = /(?:^|[^a-z0-9])test(?:$|[^a-z0-9])/i;

function parseDatabaseTarget(value, settingName) {
  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`${settingName} must be a valid PostgreSQL URL.`);
  }

  if (!POSTGRES_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error(`${settingName} must use the PostgreSQL protocol.`);
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
  } catch {
    throw new Error(`${settingName} must include a valid database name.`);
  }

  if (!parsedUrl.hostname || !databaseName || databaseName.includes('/')) {
    throw new Error(`${settingName} must include a host and database name.`);
  }

  const configuredHostname =
    parsedUrl.searchParams.getAll('host').at(-1) || parsedUrl.hostname;
  const hostnames = configuredHostname.split(',').map(normalizeHostname);
  const configuredPort =
    parsedUrl.searchParams.getAll('port').at(-1) ||
    parsedUrl.port ||
    process.env.PGPORT ||
    '5432';
  const port = Number(configuredPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${settingName} must include a valid PostgreSQL port.`);
  }

  return {
    hostnames,
    port,
    databaseName,
  };
}

function normalizeHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(normalized)
    ? '<loopback>'
    : normalized;
}

function validateTestDatabaseUrl(value, databaseUrl) {
  if (!value) {
    throw new Error(
      'TEST_DATABASE_URL is required; DATABASE_URL is never used as a test fallback.',
    );
  }

  const testDatabase = parseDatabaseTarget(value, 'TEST_DATABASE_URL');

  if (!TEST_DATABASE_NAME_TOKEN.test(testDatabase.databaseName)) {
    throw new Error(
      'TEST_DATABASE_URL must name a dedicated test database (the database name must contain a standalone "test" token).',
    );
  }

  if (databaseUrl) {
    const applicationDatabase = parseDatabaseTarget(
      databaseUrl,
      'DATABASE_URL',
    );
    if (
      testDatabase.hostnames.some((hostname) =>
        applicationDatabase.hostnames.includes(hostname),
      ) &&
      testDatabase.port === applicationDatabase.port &&
      testDatabase.databaseName === applicationDatabase.databaseName
    ) {
      throw new Error(
        'TEST_DATABASE_URL must target a dedicated database different from DATABASE_URL.',
      );
    }
  }

  return value;
}

module.exports = { validateTestDatabaseUrl };
