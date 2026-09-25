/**
 * Guard: abort unless TEST_DATABASE_URL names a disposable PostgreSQL test DB.
 *
 * This setup runs before Jest loads the app, which performs real writes.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
let testDatabaseName: string | undefined;

try {
  if (testDatabaseUrl) {
    const parsedUrl = new URL(testDatabaseUrl);
    if (
      parsedUrl.protocol === 'postgresql:' ||
      parsedUrl.protocol === 'postgres:'
    ) {
      testDatabaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
    }
  }
} catch {
  // Reject malformed URLs before the application opens a database connection.
}

if (!testDatabaseName || !testDatabaseName.toLowerCase().includes('test')) {
  throw new Error(
    '[auth-integration] TEST_DATABASE_URL must name a PostgreSQL test database.',
  );
}

// Point BetterAuth and the shared Prisma instance to the checked database.
process.env.DATABASE_URL = testDatabaseUrl;
