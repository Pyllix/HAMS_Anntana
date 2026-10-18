export type ParsedConfigBoolean =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'value'; readonly value: boolean };

export type ParsedConfigInteger =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'out-of-range' }
  | { readonly kind: 'value'; readonly value: number };

export function normalizeConfigValue(
  input: string | undefined,
): string | undefined {
  const normalized = input?.trim();
  return normalized ? normalized : undefined;
}

export function parseConfigBoolean(
  input: string | undefined,
): ParsedConfigBoolean {
  const candidate = normalizeConfigValue(input)?.toLowerCase();
  if (!candidate) return { kind: 'empty' };
  if (candidate === 'true') return { kind: 'value', value: true };
  if (candidate === 'false') return { kind: 'value', value: false };
  return { kind: 'invalid' };
}

export function parseConfigInteger(
  input: string | undefined,
  min: number,
  max: number,
): ParsedConfigInteger {
  const candidate = normalizeConfigValue(input);
  if (!candidate) return { kind: 'empty' };
  if (!/^\d+$/.test(candidate)) return { kind: 'invalid' };

  const parsed = Number(candidate);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    return { kind: 'out-of-range' };
  }
  return { kind: 'value', value: parsed };
}
