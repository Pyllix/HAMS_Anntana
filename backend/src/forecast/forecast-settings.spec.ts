import { loadForecastSettings } from './forecast-settings';

describe('loadForecastSettings', () => {
  it('keeps customer forecasting disabled when only an API key is configured', () => {
    expect(
      loadForecastSettings({ GEMINI_API_KEY: 'customer-key' }, 'customer')
        .enabled,
    ).toBe(false);
  });

  it('preserves the existing cloud default when an API key is present', () => {
    expect(
      loadForecastSettings({ GEMINI_API_KEY: 'cloud-key' }, 'cloud').enabled,
    ).toBe(true);
  });

  it('honors an explicit disabled switch even when a key is configured', () => {
    expect(
      loadForecastSettings(
        { GEMINI_API_KEY: 'cloud-key', GEMINI_ENABLED: 'false' },
        'cloud',
      ).enabled,
    ).toBe(false);
  });

  it('requires an API key when explicitly enabled', () => {
    expect(() =>
      loadForecastSettings({ GEMINI_ENABLED: 'true' }, 'customer'),
    ).toThrow(/GEMINI_API_KEY is required when GEMINI_ENABLED is true/);
  });

  it('accepts explicit customer opt-in and a bounded timeout', () => {
    expect(
      loadForecastSettings(
        {
          GEMINI_ENABLED: 'true',
          GEMINI_API_KEY: 'approved-customer-key',
          GEMINI_TIMEOUT_MS: '45000',
        },
        'customer',
      ),
    ).toEqual({
      enabled: true,
      apiKey: 'approved-customer-key',
      model: undefined,
      timeoutMs: 45000,
    });
  });

  it.each([
    ['GEMINI_ENABLED', 'sometimes'],
    ['GEMINI_TIMEOUT_MS', '999'],
    ['GEMINI_TIMEOUT_MS', '60001'],
    ['GEMINI_TIMEOUT_MS', '1.5'],
  ])('rejects invalid %s values', (setting, invalidValue) => {
    expect(() =>
      loadForecastSettings({ [setting]: invalidValue }, 'customer'),
    ).toThrow(new RegExp(setting));
  });
});
