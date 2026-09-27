import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_COOKIE = 'hams.csrf';
const SECURE_CSRF_COOKIE = '__Host-hams.csrf';

export function csrfCookieName(): string {
  return process.env.NODE_ENV === 'production'
    ? SECURE_CSRF_COOKIE
    : CSRF_COOKIE;
}

export function createCsrfToken(cookieHeader?: string | null): string {
  const nonce = randomBytes(32).toString('base64url');
  const signature = signCsrfNonce(nonce, csrfContext(cookieHeader));
  return `${nonce}.${signature}`;
}

export function isCsrfToken(
  value: string | null | undefined,
  cookieHeader?: string | null,
): value is string {
  if (!value) return false;
  const [nonce, signature, extra] = value.split('.');
  if (
    extra !== undefined ||
    !nonce ||
    !signature ||
    !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  ) {
    return false;
  }

  const expected = Buffer.from(signCsrfNonce(nonce, csrfContext(cookieHeader)));
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function trustedOrigins(): string[] {
  const candidates = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
  ];

  return [...new Set(candidates.map(normalizeOrigin).filter(isString))];
}

export function isValidCsrfRequest(input: {
  method: string;
  origin: string | null | undefined;
  csrfHeader: string | null | undefined;
  cookieHeader: string | null | undefined;
}): boolean {
  if (!UNSAFE_METHODS.has(input.method.toUpperCase())) return true;
  // Browser requests include Origin; originless clients keep the existing API contract.
  if (!input.origin) return true;

  const origin = normalizeOrigin(input.origin);
  if (
    !origin ||
    origin !== input.origin ||
    !trustedOrigins().includes(origin)
  ) {
    return false;
  }

  const csrfCookie = readCsrfCookie(input.cookieHeader);
  if (
    !isCsrfToken(input.csrfHeader, input.cookieHeader) ||
    !isCsrfToken(csrfCookie, input.cookieHeader)
  ) {
    return false;
  }

  const submitted = Buffer.from(input.csrfHeader);
  const cookie = Buffer.from(csrfCookie);
  return (
    submitted.length === cookie.length && timingSafeEqual(submitted, cookie)
  );
}

function readCsrfCookie(
  cookieHeader: string | null | undefined,
): string | undefined {
  if (!cookieHeader) return undefined;
  const cookieName = csrfCookieName();

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== cookieName)
      continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function csrfContext(cookieHeader: string | null | undefined): string {
  const cookies = parseCookies(cookieHeader);
  const authCookieNames = [
    '__Host-better-auth.session_token',
    '__Secure-better-auth.session_token',
    'better-auth.session_token',
    'hams.pre_auth',
  ];

  for (const name of authCookieNames) {
    const value = cookies.get(name);
    if (value) return `${name}:${value}`;
  }

  return 'anonymous';
}

function parseCookies(
  cookieHeader: string | null | undefined,
): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of cookieHeader?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    try {
      cookies.set(name, decodeURIComponent(part.slice(separator + 1).trim()));
    } catch {
      continue;
    }
  }
  return cookies;
}

function signCsrfNonce(nonce: string, context: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is required to sign CSRF proofs');
  }
  return createHmac('sha256', secret)
    .update(`hams-csrf-v1:${context}:${nonce}`)
    .digest('base64url');
}

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isString(value: string | null): value is string {
  return value !== null;
}
