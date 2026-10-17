import type { RuntimeConfig } from '../common/config/runtime-config';

export type ForecastSettings = RuntimeConfig['forecast'];

export const FORECAST_SETTINGS = Symbol('FORECAST_SETTINGS');
