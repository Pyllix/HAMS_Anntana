import type { InstallationMode } from '../common/config/runtime-config';

export interface ForecastSettings {
  readonly enabled: boolean;
  readonly apiKey?: string;
  readonly model?: string;
  readonly timeoutMs: number;
}

export const FORECAST_SETTINGS = Symbol('FORECAST_SETTINGS');

export function loadForecastSettings(
  environment: Readonly<Record<string, string | undefined>>,
  installationMode: InstallationMode,
): ForecastSettings {
  const apiKey = value(environment.GEMINI_API_KEY);
  const enabledValue = booleanSetting(
    environment.GEMINI_ENABLED,
    installationMode === 'cloud' && Boolean(apiKey),
  );
  const timeoutValue = integerSetting(environment.GEMINI_TIMEOUT_MS, 30000);

  const errors: string[] = [];
  if (enabledValue && !apiKey) {
    errors.push('GEMINI_API_KEY is required when GEMINI_ENABLED is true.');
  }
  if (environment.GEMINI_ENABLED?.trim() && enabledValue === undefined) {
    errors.push('GEMINI_ENABLED must be true or false.');
  }
  if (environment.GEMINI_TIMEOUT_MS?.trim() && timeoutValue === undefined) {
    errors.push(
      'GEMINI_TIMEOUT_MS must be a whole number between 1000 and 60000.',
    );
  }
  if (errors.length > 0) {
    throw new Error(
      `Invalid Gemini forecasting configuration:\n- ${errors.join('\n- ')}`,
    );
  }

  return {
    enabled: enabledValue ?? false,
    apiKey,
    model: value(environment.GEMINI_MODEL),
    timeoutMs: timeoutValue ?? 30000,
  };
}

function booleanSetting(
  rawValue: string | undefined,
  fallback: boolean,
): boolean | undefined {
  const candidate = value(rawValue)?.toLowerCase();
  if (!candidate) return fallback;
  if (candidate === 'true') return true;
  if (candidate === 'false') return false;
  return undefined;
}

function integerSetting(
  rawValue: string | undefined,
  fallback: number,
): number | undefined {
  const candidate = value(rawValue);
  if (!candidate) return fallback;
  if (!/^\d+$/.test(candidate)) return undefined;

  const parsed = Number(candidate);
  if (!Number.isSafeInteger(parsed) || parsed < 1000 || parsed > 60000) {
    return undefined;
  }
  return parsed;
}

function value(input: string | undefined): string | undefined {
  const normalized = input?.trim();
  return normalized ? normalized : undefined;
}
