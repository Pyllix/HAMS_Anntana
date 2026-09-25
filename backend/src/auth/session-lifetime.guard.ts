import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionLifetimeService } from './session-lifetime.service';

const SESSIONLESS_AUTH_ROUTES = new Set([
  'GET /auth/csrf',
  'POST /auth/sign-in',
  'POST /auth/sign-out',
  'POST /auth/send-verification-email',
]);

const SESSION_COOKIE_NAMES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
  '__Host-better-auth.session_token',
];

@Injectable()
export class SessionLifetimeGuard implements CanActivate {
  constructor(
    private readonly sessionLifetimeService: SessionLifetimeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const route = this.routeKey(request);
    if (SESSIONLESS_AUTH_ROUTES.has(route)) return true;

    const bearerToken = this.readBearerToken(request);
    const cookieToken = SESSION_COOKIE_NAMES.map((name) =>
      this.readCookie(request, name),
    )
      .map((token) => token?.split('.', 1)[0])
      .find((token): token is string => Boolean(token));
    const token = bearerToken ?? cookieToken;
    if (!token) return true;

    const userActivity = Boolean(
      !bearerToken && cookieToken && request.headers['x-user-activity'] === '1',
    );
    const window = await this.sessionLifetimeService.enforceSession(
      token,
      userActivity,
    );
    if (!window) {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Session expired. Please sign in again.',
        statusCode: 401,
      });
    }

    return true;
  }

  private readCookie(request: Request, name: string): string | undefined {
    const parsed = (request as Request & { cookies?: Record<string, string> })
      .cookies;
    if (parsed?.[name]) return parsed[name];

    for (const part of request.headers.cookie?.split(';') ?? []) {
      const separator = part.indexOf('=');
      if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
      const value = part.slice(separator + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
    return undefined;
  }
  private readBearerToken(request: Request): string | undefined {
    const match = request.headers.authorization?.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();
    return token ? token.split('.', 1)[0] : undefined;
  }

  private routeKey(request: Request): string {
    const path = (request.baseUrl ?? '') + (request.path ?? '');
    const normalized = path.replace(/\/+$/, '');
    return request.method.toUpperCase() + ' ' + (normalized || '/');
  }
}
