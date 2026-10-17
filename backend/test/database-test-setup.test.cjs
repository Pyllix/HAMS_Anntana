const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const setupPath = path.join(__dirname, 'database-test-setup.cjs');
const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      !['DATABASE_URL', 'TEST_DATABASE_URL', 'DOTENV_CONFIG_PATH'].includes(
        key,
      ),
  ),
);

function runSetup(environment) {
  return spawnSync(
    process.execPath,
    [
      '--require',
      setupPath,
      '-e',
      'process.stdout.write(`${new URL(process.env.DATABASE_URL).pathname}\\nTEST_MODULE_LOADED\\n`)',
    ],
    {
      cwd: os.tmpdir(),
      encoding: 'utf8',
      env: { ...inheritedEnvironment, ...environment },
    },
  );
}

test('rejects missing TEST_DATABASE_URL before loading a test module', () => {
  const result = runSetup({
    DATABASE_URL: 'postgresql://app:secret@db.example/hams_prod',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TEST_DATABASE_URL/);
  assert.doesNotMatch(result.stdout, /TEST_MODULE_LOADED/);
});

test('rejects a non-test PostgreSQL database before loading a test module', () => {
  const result = runSetup({
    TEST_DATABASE_URL: 'postgresql://test_user:secret@localhost:5432/hams_prod',
    DATABASE_URL: 'postgresql://app:secret@db.example/hams_prod',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /dedicated test database/i);
  assert.doesNotMatch(result.stdout, /TEST_MODULE_LOADED/);
});

test('rejects a non-PostgreSQL URL before loading a test module', () => {
  const result = runSetup({
    TEST_DATABASE_URL: 'mysql://test_user:secret@localhost:3306/hams_test',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PostgreSQL/i);
  assert.doesNotMatch(result.stdout, /TEST_MODULE_LOADED/);
});

test('uses the explicit test database before loading a test module', () => {
  const result = runSetup({
    TEST_DATABASE_URL: 'postgresql://test_user:secret@localhost:5432/hams_test',
    DATABASE_URL: 'postgresql://app:secret@db.example/hams_prod',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '/hams_test\nTEST_MODULE_LOADED\n');
});
