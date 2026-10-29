import type { InstallationMode } from '../common/config/runtime-config';
import {
  normalizeConfigValue,
  parseConfigBoolean,
  parseConfigInteger,
} from '../common/config/config-values';

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
  const apiKey = normalizeConfigValue(environment.GEMINI_API_KEY);
  const enabledValue = booleanSetting(
    environment.GEMINI_ENABLED,
    installationMode === 'cloud' && Boolean(apiKey),
  );
  const timeoutValue = integerSetting(environment.GEMINI_TIMEOUT_MS, 30000);

  const errors: string[] = [];
  if (enabledValue && !apiKey) {
    errors.push('GEMINI_API_KEY is required when GEMINI_ENABLED is true.');
  }
  if (
    normalizeConfigValue(environment.GEMINI_ENABLED) &&
    enabledValue === undefined
  ) {
    errors.push('GEMINI_ENABLED must be true or false.');
  }
  if (
    normalizeConfigValue(environment.GEMINI_TIMEOUT_MS) &&
    timeoutValue === undefined
  ) {
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
    model: normalizeConfigValue(environment.GEMINI_MODEL),
    timeoutMs: timeoutValue ?? 30000,
  };
}

function booleanSetting(
  rawValue: string | undefined,
  fallback: boolean,
): boolean | undefined {
  const parsed = parseConfigBoolean(rawValue);
  if (parsed.kind === 'empty') return fallback;
  return parsed.kind === 'value' ? parsed.value : undefined;
}

function integerSetting(
  rawValue: string | undefined,
  fallback: number,
): number | undefined {
  const parsed = parseConfigInteger(rawValue, 1000, 60000);
  if (parsed.kind === 'empty') return fallback;
  return parsed.kind === 'value' ? parsed.value : undefined;
}
