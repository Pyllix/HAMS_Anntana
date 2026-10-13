import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionLifetimeService } from './session-lifetime.service';
import { readSessionToken } from './auth-cookies';

const SESSIONLESS_AUTH_ROUTES = new Set([
  'GET /auth/csrf',
  'POST /auth/sign-in',
  'POST /auth/sign-out',
  'POST /auth/send-verification-email',
]);

@Injectable()
export class SessionLifetimeGuard implements CanActivate {
  constructor(
    private readonly sessionLifetimeService: SessionLifetimeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const route = this.routeKey(request);
    if (SESSIONLESS_AUTH_ROUTES.has(route)) return true;

    const token = readSessionToken(request);
    if (!token) return true;

    const userActivity = request.headers['x-user-activity'] === '1';
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

    Object.assign(request, { sessionExpiryWindow: window });
    return true;
  }

  private routeKey(request: Request): string {
    const path = (request.baseUrl ?? '') + (request.path ?? '');
    const normalized = path.replace(/\/+$/, '');
    return request.method.toUpperCase() + ' ' + (normalized || '/');
  }
}
