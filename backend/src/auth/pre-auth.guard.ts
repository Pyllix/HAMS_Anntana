import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PRE_AUTH_COOKIE, readCookie } from './auth-cookies';
import { PreAuthService } from './pre-auth.service';

const ENROLLMENT_ROUTES = new Set([
  'POST /auth/2fa/enable',
  'POST /auth/2fa/generate-secret',
  'POST /auth/2fa/verify-setup',
  'POST /auth/2fa/verify-enrollment',
  'POST /auth/2fa/acknowledge-recovery-codes',
  'POST /auth/2fa/confirm-backup-codes',
]);

const TOTP_ROUTES = new Set([
  'POST /auth/2fa/verify-totp',
  'POST /auth/2fa/verify-recovery-code',
]);

const COMMON_ROUTES = new Set([
  'GET /auth/session',
  'GET /auth/csrf',
  'POST /auth/sign-in',
  'POST /auth/sign-out',
  'POST /auth/send-verification-email',
]);

@Injectable()
export class PreAuthGuard implements CanActivate {
  constructor(private readonly preAuthService: PreAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const challenge = await this.preAuthService.findChallenge(
      readCookie(request, PRE_AUTH_COOKIE),
    );
    if (!challenge) return true;

    const route = this.routeKey(request);
    if (COMMON_ROUTES.has(route)) return true;
    if (challenge.state === 'ENROLLMENT' && ENROLLMENT_ROUTES.has(route)) {
      return true;
    }
    if (challenge.state === 'TOTP' && TOTP_ROUTES.has(route)) return true;

    const code =
      challenge.state === 'ENROLLMENT'
        ? 'ENROLLMENT_REQUIRED'
        : 'TOTP_VERIFICATION_REQUIRED';
    throw new ForbiddenException({
      code,
      message: 'Complete two-factor authentication before continuing',
      statusCode: 403,
    });
  }

  private routeKey(request: Request): string {
    const path = (request.baseUrl ?? '') + (request.path ?? '');
    const normalized = path.replace(/\/+$/, '');
    return request.method.toUpperCase() + ' ' + (normalized || '/');
  }
}