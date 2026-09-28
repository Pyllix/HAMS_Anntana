import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { isValidCsrfRequest } from './csrf-protection';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const valid = isValidCsrfRequest({
      method: request.method,
      origin: request.headers.origin,
      csrfHeader:
        typeof request.headers['x-csrf-token'] === 'string'
          ? request.headers['x-csrf-token']
          : undefined,
      cookieHeader:
        typeof request.headers.cookie === 'string'
          ? request.headers.cookie
          : undefined,
    });

    if (!valid) {
      throw new ForbiddenException({
        code: 'CSRF_INVALID',
        message: 'CSRF proof is missing or invalid',
        statusCode: 403,
      });
    }

    return true;
  }
}
