import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { TwoFactorService } from './two-factor.service';

type AuthenticatedRequest = Request & {
  user?: { id: string; role?: string } | null;
  session?: { user?: { id: string; role?: string } } | null;
};

@Injectable()
export class MandatoryEnrollmentGuard implements CanActivate {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const path = ((request.baseUrl ?? '') + (request.path ?? '')).replace(
      /\/+$/,
      '',
    );

    // Auth routes must stay available so a user can sign in and complete setup.
    if (path === '/auth' || path.startsWith('/auth/')) return true;
    if (path === '/api/auth' || path.startsWith('/api/auth/')) return true;

    const user = request.user ?? request.session?.user;
    if (!user?.id || !this.twoFactorService.requiresTwoFactor(user.role ?? '')) {
      return true;
    }
    if (await this.twoFactorService.hasCompletedEnrollment(user.id)) return true;

    throw new ForbiddenException({
      code: 'ENROLLMENT_REQUIRED',
      message: 'Complete two-factor authentication enrollment before continuing',
      statusCode: 403,
    });
  }
}