import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {
  loadRuntimeConfig,
  type RuntimeConfigValidator,
} from './runtime-config';

const DATABASE_URL = 'postgresql://hams:secret@localhost:5432/hams_test';
const TWO_FACTOR_ENCRYPTION_KEY = 'a'.repeat(64);

function productionEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    NODE_ENV: 'production',
    PORT: '3000',
    DATABASE_URL,
    BETTER_AUTH_SECRET: 'a'.repeat(48),
    BETTER_AUTH_URL: 'https://hams.example.test',
    FRONTEND_URL: 'https://hams.example.test',
    TWO_FACTOR_ENCRYPTION_KEY,
    SMTP_HOST: 'mail.example.test',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_REQUIRE_TLS: 'true',
    SMTP_FROM: 'HAMS <noreply@example.test>',
    ...overrides,
  };
}

describe('loadRuntimeConfig', () => {
  it('requires the runtime environment to be explicit', () => {
    expect(() => loadRuntimeConfig({ DATABASE_URL })).toThrow(
      /NODE_ENV is required/,
    );
    expect(() =>
      loadRuntimeConfig({ NODE_ENV: 'staging', DATABASE_URL }),
    ).toThrow(/NODE_ENV must be development, test, or production/);
  });

  it('uses local development defaults without requiring optional provider credentials', () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'development',
      DATABASE_URL,
    });

    expect(config.server).toEqual({
      environment: 'development',
      installationMode: 'cloud',
      port: 3000,
      secureCookies: false,
    });
    expect(config.auth).toMatchObject({
      baseUrl: 'http://localhost:3000',
      frontendUrl: 'http://localhost:5173',
    });
    expect(config.smtp).toMatchObject({
      host: 'localhost',
      port: 1025,
      secure: false,
      requireTLS: false,
      from: 'HAMS System <noreply@hams.local>',
    });
    expect(config.server.installationMode).toBe('cloud');
    expect(config.forecast.enabled).toBe(false);
  });

  it('keeps legacy cloud Gemini behavior while customer installs default to disabled even with a key', () => {
    const cloudConfig = loadRuntimeConfig({
      NODE_ENV: 'development',
      DATABASE_URL,
      GEMINI_API_KEY: 'legacy-cloud-key',
    });
    const customerConfig = loadRuntimeConfig({
      NODE_ENV: 'development',
      DATABASE_URL,
      HAMS_INSTALLATION_MODE: 'customer',
      GEMINI_API_KEY: 'customer-key-must-not-enable-forecasting',
    });

    expect(cloudConfig.forecast.enabled).toBe(true);
    expect(customerConfig.server.installationMode).toBe('customer');
    expect(customerConfig.forecast.enabled).toBe(false);
  });

  it('requires Gemini credentials only when forecasting is explicitly enabled', () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'production',
        HAMS_INSTALLATION_MODE: 'customer',
        GEMINI_ENABLED: 'true',
        ...productionEnvironment(),
      }),
    ).toThrow(/GEMINI_API_KEY is required when GEMINI_ENABLED is true/);

    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'development',
        DATABASE_URL,
        HAMS_INSTALLATION_MODE: 'unknown',
      }),
    ).toThrow(/HAMS_INSTALLATION_MODE must be cloud or customer/);
  });

  it('allows customer forecasting only after explicit enablement with a bounded timeout and key', () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'development',
      DATABASE_URL,
      HAMS_INSTALLATION_MODE: 'customer',
      GEMINI_ENABLED: 'true',
      GEMINI_API_KEY: 'authorized-customer-key',
      GEMINI_TIMEOUT_MS: '45000',
    });

    expect(config.forecast).toMatchObject({
      enabled: true,
      apiKey: 'authorized-customer-key',
      timeoutMs: 45000,
    });

    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'development',
        DATABASE_URL,
        GEMINI_TIMEOUT_MS: '60001',
      }),
    ).toThrow(/GEMINI_TIMEOUT_MS must be between 1000 and 60000/);
  });

  it('accepts a complete production installation without cloud-only provider credentials', () => {
    const config = loadRuntimeConfig(productionEnvironment());

    expect(config.server.secureCookies).toBe(true);
    expect(config.database.url).toBe(DATABASE_URL);
    expect(config.auth.frontendUrl).toBe('https://hams.example.test');
    expect(config.smtp.requireTLS).toBe(true);
    expect(config).not.toHaveProperty('cloudinary');
    expect(config).not.toHaveProperty('gemini');
  });

  it('reports all missing production settings by name without printing values', () => {
    const secret = 'do-not-echo-this-secret';

    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: secret,
      }),
    ).toThrow(/DATABASE_URL.*BETTER_AUTH_URL.*FRONTEND_URL.*SMTP_HOST/s);

    try {
      loadRuntimeConfig({ NODE_ENV: 'production', BETTER_AUTH_SECRET: secret });
    } catch (error) {
      expect(
        error instanceof Error ? error.message : String(error),
      ).not.toContain(secret);
    }
  });

  it('rejects insecure public URLs and weak production secrets', () => {
    expect(() =>
      loadRuntimeConfig(
        productionEnvironment({
          BETTER_AUTH_SECRET: 'short-secret',
          BETTER_AUTH_URL: 'http://hams.example.test',
          FRONTEND_URL: 'http://hams.example.test',
        }),
      ),
    ).toThrow(/BETTER_AUTH_SECRET[\s\S]*HTTPS/);
  });

  it('rejects invalid ports, database URLs, 2FA keys, and incomplete SMTP credentials', () => {
    expect(() =>
      loadRuntimeConfig(
        productionEnvironment({
          PORT: '3000oops',
          DATABASE_URL: 'mysql://hams:secret@localhost/hams_test',
          TWO_FACTOR_ENCRYPTION_KEY: 'not-a-key',
          SMTP_USER: 'smtp-user',
        }),
      ),
    ).toThrow(/PORT.*DATABASE_URL.*TWO_FACTOR_ENCRYPTION_KEY.*SMTP_PASS/s);
  });

  it('lets selected feature slices extend validation', () => {
    const selectedProviderValidator: RuntimeConfigValidator = (
      environment,
      addError,
    ) => {
      if (
        environment.IMAGE_STORAGE_PROVIDER === 'local' &&
        !environment.IMAGE_DATA_DIR
      ) {
        addError(
          'IMAGE_DATA_DIR',
          'is required when local image storage is selected',
        );
      }
    };

    expect(() =>
      loadRuntimeConfig(
        productionEnvironment({ IMAGE_STORAGE_PROVIDER: 'local' }),
        [selectedProviderValidator],
      ),
    ).toThrow(/IMAGE_DATA_DIR/);
  });
});

describe('production startup validation order', () => {
  it('selects production mode before starting the production entry point', () => {
    const backendRoot = path.resolve(__dirname, '../../..');
    const productionLauncherPath = path.join(
      backendRoot,
      'scripts',
      'start-production.cjs',
    );
    const script = `
      const { startProduction } = require(${JSON.stringify(productionLauncherPath)});
      process.env.NODE_ENV = 'development';
      startProduction(() => process.stdout.write(process.env.NODE_ENV));
    `;
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: backendRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('production');
  });

  it('rejects invalid settings before importing app, auth, database, or mail modules', () => {
    const backendRoot = path.resolve(__dirname, '../../..');
    const mainPath = path.join(backendRoot, 'src', 'main.ts');
    const script = `
      try {
        require(${JSON.stringify(mainPath)});
        process.exitCode = 1;
      } catch (error) {
        const loadedApplicationModules = Object.keys(require.cache).filter((id) =>
          /src[\\/](?:app\\.module|auth[\\/](?:auth|auth\\.controller)|common[\\/](?:config[\\/]database\\.config|mail[\\/]mail\\.service))\\.ts$/.test(id),
        );
        process.stdout.write(JSON.stringify({
          loadedApplicationModules: loadedApplicationModules.length,
          message: error instanceof Error ? error.message : String(error),
        }));
        process.exitCode = loadedApplicationModules.length === 0 ? 0 : 1;
      }
    `;
    const result = spawnSync(
      process.execPath,
      ['--require', 'ts-node/register', '-e', script],
      {
        cwd: backendRoot,
        encoding: 'utf8',
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) =>
                ![
                  'NODE_ENV',
                  'DATABASE_URL',
                  'TEST_DATABASE_URL',
                  'BETTER_AUTH_SECRET',
                  'BETTER_AUTH_URL',
                  'FRONTEND_URL',
                  'TWO_FACTOR_ENCRYPTION_KEY',
                  'SMTP_HOST',
                  'SMTP_PORT',
                  'SMTP_SECURE',
                  'SMTP_REQUIRE_TLS',
                  'SMTP_USER',
                  'SMTP_PASS',
                  'SMTP_FROM',
                  'HAMS_INSTALLATION_MODE',
                  'GEMINI_ENABLED',
                  'GEMINI_API_KEY',
                  'GEMINI_MODEL',
                  'GEMINI_TIMEOUT_MS',
                  'DOTENV_CONFIG_PATH',
                ].includes(key),
            ),
          ),
          NODE_ENV: 'production',
          DOTENV_CONFIG_PATH: path.join(os.tmpdir(), 'hams-no-env-file'),
        },
      },
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      loadedApplicationModules: 0,
    });
    expect(result.stdout).toContain('DATABASE_URL');
  });
});
