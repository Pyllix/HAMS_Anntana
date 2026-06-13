import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public, Session } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import type { Session as BetterAuthSession } from 'better-auth/types';
import { auth } from './auth';
import { SignInDto } from './dto/sign-in.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  // ─── Sign In ───────────────────────────────────────────────────────────────

  @Post('sign-in')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in',
    description: 'Authenticate with email and password — returns a session token',
  })
  @ApiBody({ type: SignInDto })
  @ApiResponse({
    status: 200,
    description: 'Sign-in successful',
    schema: {
      example: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: { id: 'uuid', email: 'admin@hospital.go.th', name: 'System Admin' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async signIn(@Body() dto: SignInDto, @Req() req: Request) {
    // Forward the real request headers so better-auth has full context
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    const result = await auth.api.signInEmail({
      headers,
      body: { email: dto.email, password: dto.password },
    });

    if (!result?.token) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      token: result.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
    };
  }

  // ─── Sign Out ──────────────────────────────────────────────────────────────

  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sign out',
    description: 'Invalidate the current session token',
  })
  @ApiResponse({ status: 200, description: 'Signed out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — no active session' })
  async signOut(@Req() req: Request) {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    await auth.api.signOut({ headers });

    return { message: 'Signed out successfully' };
  }

  // ─── Get Session ───────────────────────────────────────────────────────────

  @Get('session')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current session',
    description: 'Returns the current authenticated session info',
  })
  @ApiResponse({ status: 200, description: 'Current session data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSession(@Session() session: BetterAuthSession) {
    return {
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        userId: session.userId,
      },
    };
  }
}
