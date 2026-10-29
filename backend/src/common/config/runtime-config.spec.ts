import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { loadRuntimeConfig } from './runtime-config';

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
  });

  it('rejects unsupported installation modes', () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: 'development',
        DATABASE_URL,
        HAMS_INSTALLATION_MODE: 'unknown',
      }),
    ).toThrow(/HAMS_INSTALLATION_MODE must be cloud or customer/);
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

  it('configures local image storage without Cloudinary credentials', () => {
    const storageRoot = path.join(os.tmpdir(), 'hams-image-test-data');
    const config = loadRuntimeConfig(
      productionEnvironment({
        IMAGE_STORAGE_PROVIDER: 'local',
        IMAGE_STORAGE_ROOT: storageRoot,
      }),
    );

    expect(config.images).toEqual({
      provider: 'local',
      storageRoot: path.resolve(storageRoot),
      tempRoot: path.join(path.resolve(storageRoot), '.staging'),
    });
  });

  it('requires local image storage paths to be absolute and outside the app directory', () => {
    expect(() =>
      loadRuntimeConfig(
        productionEnvironment({ IMAGE_STORAGE_PROVIDER: 'local' }),
      ),
    ).toThrow(/IMAGE_STORAGE_ROOT is required/);
    expect(() =>
      loadRuntimeConfig(
        productionEnvironment({
          IMAGE_STORAGE_PROVIDER: 'local',
          IMAGE_STORAGE_ROOT: 'relative-images',
        }),
      ),
    ).toThrow(/IMAGE_STORAGE_ROOT must be an absolute path/);
    const originalWorkingDirectory = process.cwd();
    try {
      process.chdir(os.tmpdir());
      expect(() =>
        loadRuntimeConfig(
          productionEnvironment({
            IMAGE_STORAGE_PROVIDER: 'local',
            IMAGE_STORAGE_ROOT: path.resolve(__dirname, '../../../images'),
          }),
        ),
      ).toThrow(
        /IMAGE_STORAGE_ROOT must be outside the application release directory/,
      );
    } finally {
      process.chdir(originalWorkingDirectory);
    }
  });

  it.each(['same', 'child', 'parent'])(
    'requires separate local image and temporary storage roots (%s)',
    (overlap) => {
      const storageRoot = path.join(os.tmpdir(), 'hams-image-same-root');
      const tempRoot =
        overlap === 'child'
          ? path.join(
              storageRoot,
              'hams-asset-image-c4c51a2e-3c27-4e68-9954-0c7c03b1564b',
            )
          : overlap === 'parent'
            ? path.dirname(storageRoot)
            : storageRoot;

      expect(() =>
        loadRuntimeConfig(
          productionEnvironment({
            IMAGE_STORAGE_PROVIDER: 'local',
            IMAGE_STORAGE_ROOT: storageRoot,
            IMAGE_STORAGE_TEMP_ROOT: tempRoot,
          }),
        ),
      ).toThrow(/IMAGE_STORAGE_TEMP_ROOT must be separate/);
    },
  );

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

  describe('customer HTTP opt-in', () => {
    const httpEnvironment = {
      HAMS_INSTALLATION_MODE: 'customer',
      BETTER_AUTH_URL: 'http://hams.example.test:20443',
      FRONTEND_URL: 'http://hams.example.test:20443',
    };

    it.each([undefined, 'false'])(
      'rejects HTTP when the opt-in is %s',
      (value) => {
        expect(() =>
          loadRuntimeConfig(
            productionEnvironment({
              ...httpEnvironment,
              HAMS_ALLOW_INSECURE_HTTP: value,
            }),
          ),
        ).toThrow(/BETTER_AUTH_URL.*HTTPS[\s\S]*FRONTEND_URL.*HTTPS/);
      },
    );

    it('allows explicitly enabled HTTP without switching out of production', () => {
      const config = loadRuntimeConfig(
        productionEnvironment({
          ...httpEnvironment,
          HAMS_ALLOW_INSECURE_HTTP: 'true',
        }),
      );

      expect(config.server).toMatchObject({
        environment: 'production',
        installationMode: 'customer',
        secureCookies: false,
      });
      expect(config.auth).toMatchObject({
        baseUrl: httpEnvironment.BETTER_AUTH_URL,
        frontendUrl: httpEnvironment.FRONTEND_URL,
      });
      expect(config.smtp.requireTLS).toBe(true);
    });

    it('keeps secure cookies for HTTPS even when the HTTP opt-in is enabled', () => {
      expect(
        loadRuntimeConfig(
          productionEnvironment({
            HAMS_INSTALLATION_MODE: 'customer',
            HAMS_ALLOW_INSECURE_HTTP: 'true',
          }),
        ).server.secureCookies,
      ).toBe(true);
    });

    it('does not allow the customer opt-in to weaken cloud installations', () => {
      expect(() =>
        loadRuntimeConfig(
          productionEnvironment({
            ...httpEnvironment,
            HAMS_INSTALLATION_MODE: 'cloud',
            HAMS_ALLOW_INSECURE_HTTP: 'true',
          }),
        ),
      ).toThrow(/HAMS_ALLOW_INSECURE_HTTP.*customer/);
    });

    it('rejects invalid opt-in values rather than silently enabling HTTP', () => {
      expect(() =>
        loadRuntimeConfig(
          productionEnvironment({
            ...httpEnvironment,
            HAMS_ALLOW_INSECURE_HTTP: 'yes',
          }),
        ),
      ).toThrow(/HAMS_ALLOW_INSECURE_HTTP must be true or false/);
    });

    it.each([
      { BETTER_AUTH_URL: 'https://hams.example.test:20443' },
      { FRONTEND_URL: 'https://hams.example.test:20443' },
    ])('rejects mixed HTTP and HTTPS URLs (%j)', (overrides) => {
      expect(() =>
        loadRuntimeConfig(
          productionEnvironment({
            ...httpEnvironment,
            HAMS_ALLOW_INSECURE_HTTP: 'true',
            ...overrides,
          }),
        ),
      ).toThrow(/BETTER_AUTH_URL and FRONTEND_URL must use the same protocol/);
    });

    it('retains production secret, SMTP TLS and URL validation in HTTP mode', () => {
      expect(() =>
        loadRuntimeConfig(
          productionEnvironment({
            ...httpEnvironment,
            HAMS_ALLOW_INSECURE_HTTP: 'true',
            BETTER_AUTH_SECRET: 'short-secret',
            TWO_FACTOR_ENCRYPTION_KEY: 'invalid-key',
            SMTP_REQUIRE_TLS: 'false',
            FRONTEND_URL: 'http://hams.example.test:20443?unexpected=query',
          }),
        ),
      ).toThrow(
        /BETTER_AUTH_SECRET[\s\S]*query or fragment[\s\S]*TWO_FACTOR_ENCRYPTION_KEY[\s\S]*SMTP_REQUIRE_TLS/,
      );
    });
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
                  'HAMS_ALLOW_INSECURE_HTTP',
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
