import type { Request } from 'express';

export const PRE_AUTH_COOKIE = 'hams.pre_auth';
export const TRUSTED_BROWSER_COOKIE = 'better-auth.trust_device';

export function readCookie(request: Request, name: string): string | undefined {
  const parsed = (request as Request & { cookies?: Record<string, string> }).cookies;
  if (parsed?.[name]) return parsed[name];

  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

export function isSecureCookie(): boolean {
  return process.env.NODE_ENV === 'production';
}