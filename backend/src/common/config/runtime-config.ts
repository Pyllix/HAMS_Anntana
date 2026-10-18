import {
  normalizeConfigValue,
  parseConfigBoolean,
  parseConfigInteger,
} from './config-values';

export type RuntimeEnvironment = 'development' | 'test' | 'production';
export type InstallationMode = 'cloud' | 'customer';

export interface RuntimeConfig {
  readonly server: {
    readonly environment: RuntimeEnvironment;
    readonly installationMode: InstallationMode;
    readonly port: number;
    readonly secureCookies: boolean;
  };
  readonly database: {
    readonly url: string;
    readonly poolMax: number;
  };
  readonly auth: {
    readonly secret?: string;
    readonly baseUrl: string;
    readonly frontendUrl: string;
  };
  readonly twoFactor: {
    readonly encryptionKey?: string;
  };
  readonly smtp: {
    readonly host: string;
    readonly port: number;
    readonly secure: boolean;
    readonly requireTLS: boolean;
    readonly user?: string;
    readonly pass?: string;
    readonly from: string;
  };
}

export type RuntimeConfigErrorReporter = (
  setting: string,
  reason: string,
) => void;

const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const NODE_ENVIRONMENTS = new Set<RuntimeEnvironment>([
  'development',
  'test',
  'production',
]);

export function loadRuntimeConfig(
  environment: Readonly<Record<string, string | undefined>>,
): RuntimeConfig {
  const errors: string[] = [];
  const addError: RuntimeConfigErrorReporter = (setting, reason) => {
    errors.push(`${setting} ${reason}`);
  };
  const environmentName = normalizeConfigValue(environment.NODE_ENV);
  if (!environmentName) {
    addError(
      'NODE_ENV',
      'is required; set it to development, test, or production.',
    );
  }
  const isSupportedEnvironment = NODE_ENVIRONMENTS.has(
    environmentName as RuntimeEnvironment,
  );
  const nodeEnvironment = isSupportedEnvironment
    ? (environmentName as RuntimeEnvironment)
    : 'development';
  if (environmentName && !isSupportedEnvironment) {
    addError('NODE_ENV', 'must be development, test, or production.');
  }
  const isProduction = nodeEnvironment === 'production';

  const installationModeName =
    normalizeConfigValue(environment.HAMS_INSTALLATION_MODE) || 'cloud';
  const isSupportedInstallationMode = ['cloud', 'customer'].includes(
    installationModeName,
  );
  if (!isSupportedInstallationMode) {
    addError('HAMS_INSTALLATION_MODE', 'must be cloud or customer.');
  }
  const installationMode: InstallationMode = isSupportedInstallationMode
    ? (installationModeName as InstallationMode)
    : 'cloud';

  const port = integerSetting({
    name: 'PORT',
    rawValue: environment.PORT,
    fallback: 3000,
    min: 1,
    max: 65535,
    addError,
  });
  const databasePoolMax = integerSetting({
    name: 'DATABASE_POOL_MAX',
    rawValue: environment.DATABASE_POOL_MAX,
    fallback: 20,
    min: 1,
    max: 1000,
    addError,
  });
  const databaseUrl = postgresUrl(environment.DATABASE_URL, addError);

  const authSecret = normalizeConfigValue(environment.BETTER_AUTH_SECRET);
  if (isProduction && !authSecret) {
    addError('BETTER_AUTH_SECRET', 'is required in production.');
  } else if (isProduction && authSecret && authSecret.length < 32) {
    addError('BETTER_AUTH_SECRET', 'must contain at least 32 characters.');
  }

  const authBaseUrl = httpUrl({
    name: 'BETTER_AUTH_URL',
    rawValue: environment.BETTER_AUTH_URL,
    fallback: 'http://localhost:3000',
    required: isProduction,
    requireHttps: isProduction,
    addError,
  });
  const frontendUrl = httpUrl({
    name: 'FRONTEND_URL',
    rawValue: environment.FRONTEND_URL,
    fallback: 'http://localhost:5173',
    required: isProduction,
    requireHttps: isProduction,
    addError,
  });

  const twoFactorEncryptionKey = normalizeConfigValue(
    environment.TWO_FACTOR_ENCRYPTION_KEY,
  );
  if (isProduction && !twoFactorEncryptionKey) {
    addError('TWO_FACTOR_ENCRYPTION_KEY', 'is required in production.');
  } else if (
    twoFactorEncryptionKey &&
    !/^[a-f\d]{64}$/i.test(twoFactorEncryptionKey)
  ) {
    addError(
      'TWO_FACTOR_ENCRYPTION_KEY',
      'must be 64 hexadecimal characters (32 bytes).',
    );
  }

  const smtpHost = normalizeConfigValue(environment.SMTP_HOST);
  if (isProduction && !smtpHost) {
    addError('SMTP_HOST', 'is required in production.');
  }
  const smtpPort = integerSetting({
    name: 'SMTP_PORT',
    rawValue: environment.SMTP_PORT,
    fallback: 1025,
    required: isProduction,
    min: 1,
    max: 65535,
    addError,
  });
  const smtpSecure = booleanSetting(
    'SMTP_SECURE',
    environment.SMTP_SECURE,
    false,
    addError,
  );
  const smtpRequireTls = booleanSetting(
    'SMTP_REQUIRE_TLS',
    environment.SMTP_REQUIRE_TLS,
    false,
    addError,
  );
  if (isProduction && !smtpSecure && !smtpRequireTls) {
    addError(
      'SMTP_REQUIRE_TLS',
      'or SMTP_SECURE must enable TLS in production.',
    );
  }

  const smtpUser = normalizeConfigValue(environment.SMTP_USER);
  const smtpPass = normalizeConfigValue(environment.SMTP_PASS);
  if (Boolean(smtpUser) !== Boolean(smtpPass)) {
    addError('SMTP_USER and SMTP_PASS', 'must be configured together.');
  }
  const smtpFrom = normalizeConfigValue(environment.SMTP_FROM);
  if (isProduction && !smtpFrom) {
    addError('SMTP_FROM', 'is required in production.');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid HAMS configuration:\n- ${errors.join('\n- ')}`);
  }

  return {
    server: {
      environment: nodeEnvironment,
      installationMode,
      port,
      secureCookies: isProduction,
    },
    database: {
      url: databaseUrl!,
      poolMax: databasePoolMax,
    },
    auth: {
      secret: authSecret,
      baseUrl: authBaseUrl,
      frontendUrl,
    },
    twoFactor: {
      encryptionKey: twoFactorEncryptionKey,
    },
    smtp: {
      host: smtpHost || 'localhost',
      port: smtpPort,
      secure: smtpSecure,
      requireTLS: smtpRequireTls,
      user: smtpUser,
      pass: smtpPass,
      from: smtpFrom || 'HAMS System <noreply@hams.local>',
    },
  };
}

function postgresUrl(
  rawValue: string | undefined,
  addError: RuntimeConfigErrorReporter,
): string | undefined {
  const candidate = normalizeConfigValue(rawValue);
  if (!candidate) {
    addError('DATABASE_URL', 'is required.');
    return undefined;
  }

  try {
    const parsed = new URL(candidate);
    const databaseName = decodeURIComponent(parsed.pathname.slice(1));
    if (
      !POSTGRES_PROTOCOLS.has(parsed.protocol) ||
      !parsed.hostname ||
      !databaseName ||
      databaseName.includes('/')
    ) {
      addError(
        'DATABASE_URL',
        'must be a PostgreSQL URL with host and database.',
      );
      return undefined;
    }
  } catch {
    addError('DATABASE_URL', 'must be a valid PostgreSQL URL.');
    return undefined;
  }

  return candidate;
}

function httpUrl(input: {
  name: string;
  rawValue: string | undefined;
  fallback: string;
  required: boolean;
  requireHttps: boolean;
  addError: RuntimeConfigErrorReporter;
}): string {
  const candidate = normalizeConfigValue(input.rawValue);
  if (!candidate && input.required) {
    input.addError(input.name, 'is required in production.');
  }
  const configuredUrl = candidate || input.fallback;

  try {
    const parsed = new URL(configuredUrl);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      input.addError(
        input.name,
        'must be an absolute HTTP(S) URL without credentials.',
      );
    } else if (input.requireHttps && parsed.protocol !== 'https:') {
      input.addError(input.name, 'must use HTTPS in production.');
    }
    if (input.requireHttps && (parsed.search || parsed.hash)) {
      input.addError(
        input.name,
        'must not include a query or fragment in production.',
      );
    }
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    input.addError(input.name, 'must be a valid absolute HTTP(S) URL.');
    return input.fallback;
  }
}

function integerSetting(input: {
  name: string;
  rawValue: string | undefined;
  fallback: number;
  required?: boolean;
  min: number;
  max: number;
  addError: RuntimeConfigErrorReporter;
}): number {
  const parsed = parseConfigInteger(input.rawValue, input.min, input.max);
  if (parsed.kind === 'empty') {
    if (input.required) input.addError(input.name, 'is required.');
    return input.fallback;
  }

  if (parsed.kind === 'invalid') {
    input.addError(input.name, 'must be a whole number.');
    return input.fallback;
  }

  if (parsed.kind === 'out-of-range') {
    input.addError(
      input.name,
      `must be between ${input.min} and ${input.max}.`,
    );
    return input.fallback;
  }
  return parsed.value;
}

function booleanSetting(
  name: string,
  rawValue: string | undefined,
  fallback: boolean,
  addError: RuntimeConfigErrorReporter,
): boolean {
  const parsed = parseConfigBoolean(rawValue);
  if (parsed.kind === 'empty') return fallback;
  if (parsed.kind === 'invalid') {
    addError(name, 'must be true or false.');
    return fallback;
  }
  return parsed.value;
}
