import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
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
import { ChangePasswordDto } from './dto/change-password.dto';
import { SendVerificationEmailDto } from './dto/send-verification-email.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  // ─── Sign In ───────────────────────────────────────────────────────────────

  @Post('sign-in')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in',
    description:
      'Authenticate with email and password — returns a session token',
  })
  @ApiBody({ type: SignInDto })
  @ApiResponse({
    status: 200,
    description: 'Sign-in successful',
    schema: {
      example: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'uuid',
          email: 'admin@hospital.go.th',
          name: 'System Admin',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @ApiResponse({
    status: 403,
    description: 'Email not verified (อีเมลยังไม่ได้รับการยืนยัน)',
  })
  async signIn(@Body() dto: SignInDto, @Req() req: Request) {
    // Forward the real request headers so better-auth has full context
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    try {
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
    } catch (error: any) {
      if (
        error?.status === 403 ||
        error?.statusCode === 403 ||
        error?.body?.code === 'EMAIL_NOT_VERIFIED' ||
        error?.code === 'EMAIL_NOT_VERIFIED' ||
        error?.message === 'Email not verified' ||
        error?.body?.message === 'Email not verified'
      ) {
        throw new ForbiddenException({
          code: 'EMAIL_NOT_VERIFIED',
          message: 'อีเมลยังไม่ได้รับการยืนยัน กรุณาตรวจสอบกล่องข้อความอีเมลของคุณ',
        });
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid email or password');
    }
  }

  // ─── Send Verification Email (Resend) ──────────────────────────────────────

  @Post('send-verification-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send verification email',
    description: 'ส่งอีเมลยืนยันตัวตนซ้ำไปยังอีเมลของผู้ใช้งาน (Resend Verification Email)',
  })
  @ApiBody({ type: SendVerificationEmailDto })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent successfully',
    schema: {
      example: {
        status: true,
        message: 'Verification email sent successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request or email already verified',
  })
  async sendVerificationEmail(
    @Body() dto: SendVerificationEmailDto,
    @Req() req: Request,
  ) {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const callbackURL = dto.callbackURL || `${frontendUrl}/login?verified=true`;

    try {
      await auth.api.sendVerificationEmail({
        headers,
        body: {
          email: dto.email,
          callbackURL,
        },
      });

      return {
        status: true,
        message: 'Verification email sent successfully',
      };
    } catch (error: any) {
      if (error?.status === 400 || error?.statusCode === 400) {
        throw new BadRequestException(
          error?.body?.message || error?.message || 'Failed to send verification email',
        );
      }
      throw error;
    }
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
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    await auth.api.signOut({ headers });

    return { message: 'Signed out successfully' };
  }

  // ─── Change Password (Self-Service) ───────────────────────────────────────

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change password (Self-Service)',
    description:
      'Change own password by verifying current password — revokes other sessions by default',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid current password or password policy violation',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    const result = await auth.api.changePassword({
      headers,
      body: {
        currentPassword: dto.currentPassword,
        newPassword: dto.newPassword,
        revokeOtherSessions: true,
      },
    });

    return {
      message: 'Password changed successfully',
      ...result,
    };
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

