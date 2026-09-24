/**
 * Guard: abort if TEST_DATABASE_URL is not set.
 *
 * The auth-integration test suite spins up the real NestJS app against a real
 * database. Running it against a shared or production database would be
 * destructive. This file is listed in jest-auth-integration.json's
 * "setupFiles" so it runs before any test module is compiled.
 */
if (!process.env.TEST_DATABASE_URL) {
  console.error(
    '\n[auth-integration] TEST_DATABASE_URL is not set.\n' +
      'Set it to a disposable test database URL and retry.\n' +
      '  $env:TEST_DATABASE_URL = "postgresql://..."\n',
  );
  process.exit(1);
}

// Point BetterAuth's Prisma adapter and the shared Prisma instance to the
// test database for the duration of this test run.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
