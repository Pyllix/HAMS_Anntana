import type { Request } from 'express';

export const PRE_AUTH_COOKIE = 'hams.pre_auth';
export const TRUSTED_BROWSER_COOKIE = 'better-auth.trust_device';
export const SESSION_COOKIE_NAMES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
  '__Host-better-auth.session_token',
] as const;

export function readCookie(request: Request, name: string): string | undefined {
  const parsed = (
    request as unknown as {
      cookies?: Record<string, unknown>;
    }
  ).cookies;
  const parsedValue = parsed?.[name];
  if (typeof parsedValue === 'string' && parsedValue) return parsedValue;

  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      const value = part.slice(separator + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return undefined;
}

export function readSessionToken(request: Request): string | undefined {
  return SESSION_COOKIE_NAMES.map((name) => readCookie(request, name))
    .map((token) => token?.split('.', 1)[0])
    .find((token): token is string => Boolean(token));
}

export function isSecureCookie(): boolean {
  return process.env.NODE_ENV === 'production';
}
