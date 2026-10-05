import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public, Session, Optional } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { Request, Response } from 'express';
import type { Session as BetterAuthSession } from 'better-auth/types';
import { verifyPassword } from 'better-auth/crypto';
import {
  createCsrfToken,
  csrfCookieName,
  isCsrfToken,
} from './csrf-protection';
import { auth } from './auth';
import { sharedPrisma } from '../common/config/database.config';
import type { SessionExpiryWindow } from './session-lifetime.service';
import { AdminStepUpService } from './admin-step-up.service';
import { SignInDto } from './dto/sign-in.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SendVerificationEmailDto } from './dto/send-verification-email.dto';
import { TwoFactorService } from './two-factor.service';
import { TrustedBrowserService } from './trusted-browser.service';
import { PreAuthService, type PreAuthState } from './pre-auth.service';
import {
  PRE_AUTH_COOKIE,
  TRUSTED_BROWSER_COOKIE,
  isSecureCookie,
  readCookie,
} from './auth-cookies';
import {
  VerifyEnrollmentDto,
  ConfirmBackupCodesDto,
  EnableTwoFactorDto,
  AcknowledgeRecoveryCodesDto,
  VerifyChallengeCodeDto,
  ReplaceAuthenticatorDto,
  VerifyTotpCodeDto,
} from './dto/two-factor.dto';
import { VerifyTwoFactorDto, RevokeTrustDto } from './dto/trusted-browser.dto';
import { ImageReadService } from '../images/image-read.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly twoFactorService: TwoFactorService,
    private readonly trustedBrowserService: TrustedBrowserService,
    private readonly preAuthService: PreAuthService,
    private readonly adminStepUpService: AdminStepUpService,
    private readonly imageReadService: ImageReadService,
  ) {}
  // ─── Sign In ───────────────────────────────────────────────────────────────

  @Post('sign-in')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in',
    description:
      'Authenticate with email and password — establishes an HttpOnly session cookie',
  })
  @ApiBody({ type: SignInDto })
  @ApiResponse({
    status: 200,
    description: 'Sign-in successful',
    schema: {
      example: {
        user: {
          id: 'uuid',
          email: 'admin@hospital.go.th',
          name: 'System Admin',
          role: 'DEPARTMENT_STAFF',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @ApiResponse({
    status: 403,
    description: 'Email not verified (อีเมลยังไม่ได้รับการยืนยัน)',
  })
  async signIn(
    @Body() dto: SignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const headers = this.toHeaders(req);
    try {
      const apiCall = await auth.api.signInEmail({
        headers,
        body: { email: dto.email, password: dto.password },
        returnHeaders: true,
      });
      const envelope = apiCall as unknown as {
        response?: unknown;
        headers?: Headers;
      };
      const resultValue: Record<string, unknown> = isRecord(envelope.response)
        ? envelope.response
        : (apiCall as unknown as Record<string, unknown>);
      if (!isRecord(resultValue)) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const token =
        typeof resultValue.token === 'string' ? resultValue.token : '';
      const rawUser = isRecord(resultValue.user) ? resultValue.user : null;
      if (!token || !rawUser || typeof rawUser.id !== 'string') {
        throw new UnauthorizedException('Invalid email or password');
      }

      const userId = rawUser.id;
      const userEmail =
        typeof rawUser.email === 'string' ? rawUser.email : dto.email;
      const userName = typeof rawUser.name === 'string' ? rawUser.name : '';
      let role = typeof rawUser.role === 'string' ? rawUser.role : '';
      if (!role) {
        const persistedUser = await this.preAuthService.getUserSnapshot(userId);
        role = persistedUser?.role ?? '';
      }

      const responseCookies = this.setCookieHeaders(envelope.headers);
      const sessionCookies = responseCookies.filter((cookie) =>
        /(?:__Secure-|__Host-)?better-auth\.(?:session_token|session_data)(?:\.\d+)?=/i.test(
          cookie,
        ),
      );
      const browserToken = readCookie(req, TRUSTED_BROWSER_COOKIE);
      const trust = await this.trustedBrowserService.resolveTrustForSignIn(
        userId,
        browserToken,
      );
      if (browserToken && !trust.trusted) {
        this.clearCookie(res, TRUSTED_BROWSER_COOKIE);
      }

      if (this.twoFactorService.requiresTwoFactor(role)) {
        const enrolled =
          await this.twoFactorService.hasCompletedEnrollment(userId);
        if (trust.trusted && enrolled) {
          this.appendCookies(res, responseCookies);
          return {
            requiresTwoFactor: false,
            trustedBrowser: true,
            user: { id: userId, email: userEmail, name: userName, role },
          };
        }

        const state: PreAuthState = enrolled ? 'TOTP' : 'ENROLLMENT';
        const challenge = await this.preAuthService.createChallenge({
          userId,
          state,
          sessionToken: token,
          sessionCookies,
        });
        this.setPreAuthCookie(res, challenge.token, challenge.expiresAt);
        this.clearSessionCookies(req, res);
        return {
          requiresTwoFactor: true,
          twoFactorRedirect:
            state === 'ENROLLMENT' ? '/2fa/enroll' : '/2fa/verify',
        };
      }

      this.appendCookies(res, responseCookies);
      return {
        user: { id: userId, email: userEmail, name: userName, role },
      };
    } catch (error: unknown) {
      const details = isRecord(error) ? error : {};
      const body = isRecord(details.body) ? details.body : {};
      if (
        body.code === 'EMAIL_NOT_VERIFIED' ||
        details.code === 'EMAIL_NOT_VERIFIED' ||
        details.message === 'Email not verified' ||
        body.message === 'Email not verified'
      ) {
        throw new ForbiddenException({
          code: 'EMAIL_NOT_VERIFIED',
          message:
            'อีเมลยังไม่ได้รับการยืนยัน กรุณาตรวจสอบกล่องข้อความอีเมลของคุณ',
        });
      }
      if (error instanceof HttpException) throw error;
      if (
        details.status === 401 ||
        details.status === 'UNAUTHORIZED' ||
        details.statusCode === 401 ||
        body.code === 'INVALID_EMAIL_OR_PASSWORD' ||
        details.code === 'INVALID_EMAIL_OR_PASSWORD'
      ) {
        if (process.env.AUTH_DB_DIAGNOSTICS === '1') {
          const code = body.code ?? details.code;
          this.logger.warn(
            `[AuthSignInRejected] code=${typeof code === 'string' ? code : 'unknown'}`,
          );
        }
        await this.logSignInLookup(dto.email, dto.password);
        throw new UnauthorizedException('Invalid email or password');
      }

      this.logger.error(
        'Sign-in failed unexpectedly',
        error instanceof Error
          ? error.stack
          : JSON.stringify({
              code: details.code,
              status: details.status ?? details.statusCode,
            }),
      );
      throw new InternalServerErrorException('Sign-in could not be completed');
    }
  }

  private async logSignInLookup(
    email: string,
    password: string,
  ): Promise<void> {
    if (process.env.AUTH_DB_DIAGNOSTICS !== '1') return;

    try {
      const [identity] = await sharedPrisma.$queryRaw<
        Array<{ database: string; schema: string }>
      >`SELECT current_database() AS database, current_schema() AS schema`;
      const [submittedUser, demoAdmin] = await Promise.all([
        sharedPrisma.user.findUnique({
          where: { email },
          select: { id: true },
        }),
        sharedPrisma.user.findUnique({
          where: { email: 'admin@hospital.go.th' },
          select: { id: true },
        }),
      ]);
      const probe = async (run: () => Promise<unknown>): Promise<string> => {
        try {
          return String(Boolean(await run()));
        } catch (error) {
          return `error:${error instanceof Error ? error.name : 'unknown'}`;
        }
      };
      const prismaFindFirst = await probe(() =>
        sharedPrisma.user.findFirst({
          where: { email: { equals: email.toLowerCase() } },
          select: { id: true, accounts: { take: 1, select: { id: true } } },
        }),
      );
      const authContext = await auth.$context;
      const adapterUser = await probe(() =>
        authContext.adapter.findOne({
          model: 'user',
          where: [{ field: 'email', value: email.toLowerCase() }],
          join: { account: true },
        }),
      );
      const internalUser = await probe(() =>
        authContext.internalAdapter.findUserByEmail(email, {
          includeAccounts: true,
        }),
      );
      const credentialAccount = submittedUser
        ? await sharedPrisma.account.findFirst({
            where: { userId: submittedUser.id, providerId: 'credential' },
            select: { password: true },
          })
        : null;
      const credentialHash = credentialAccount?.password;
      const passwordMatches = credentialHash
        ? await probe(() => verifyPassword({ hash: credentialHash, password }))
        : 'false';
      this.logger.warn(
        `[AuthDbDiagnostics] database=${identity.database} schema=${identity.schema} ` +
          `submittedEmailIsDemoAdmin=${email === 'admin@hospital.go.th'} ` +
          `submittedUserExists=${Boolean(submittedUser)} demoAdminExists=${Boolean(demoAdmin)} ` +
          `prismaFindFirstExists=${prismaFindFirst} ` +
          `adapterFindOneExists=${adapterUser} internalUserExists=${internalUser} ` +
          `credentialAccountExists=${Boolean(credentialAccount)} passwordMatches=${passwordMatches}`,
      );
    } catch (error) {
      this.logger.warn(
        `[AuthDbDiagnostics] lookup failed (${error instanceof Error ? error.name : 'unknown error'})`,
      );
    }
  }
  // ─── Send Verification Email (Resend) ──────────────────────────────────────

  @Post('send-verification-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send verification email',
    description:
      'ส่งอีเมลยืนยันตัวตนซ้ำไปยังอีเมลของผู้ใช้งาน (Resend Verification Email)',
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
    } catch (error: unknown) {
      const details = isRecord(error) ? error : {};
      const body = isRecord(details.body) ? details.body : {};
      if (details.status === 400 || details.statusCode === 400) {
        const message =
          typeof body.message === 'string'
            ? body.message
            : typeof details.message === 'string'
              ? details.message
              : 'Failed to send verification email';
        throw new BadRequestException(message);
      }
      throw error;
    }
  }

  // ─── Sign Out ──────────────────────────────────────────────────────────────

  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Sign out',
    description: 'Invalidate the current session token',
  })
  @ApiResponse({ status: 200, description: 'Signed out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — no active session' })
  @Public()
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const preAuthToken = readCookie(req, PRE_AUTH_COOKIE);
    const challenge = await this.preAuthService.findChallenge(preAuthToken);
    if (challenge) {
      await this.preAuthService.cancelChallenge(preAuthToken);
      this.clearCookie(res, PRE_AUTH_COOKIE);
      this.clearSessionCookies(req, res);
      return { message: 'Signed out successfully' };
    }

    const result = await auth.api.signOut({
      headers: this.toHeaders(req),
      returnHeaders: true,
    });
    const envelope = result as unknown as { headers?: Headers };
    this.appendCookies(res, this.setCookieHeaders(envelope.headers));
    return { message: 'Signed out successfully' };
  }
  // ─── Change Password (Self-Service) ───────────────────────────────────────

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Change password (Self-Service)',
    description:
      'Change own password by verifying current password — revokes other sessions and all trusted browsers by default',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid current password or password policy violation',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Session() session: UserSession<typeof auth>,
  ) {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    const apiCall = await auth.api.changePassword({
      headers,
      body: {
        currentPassword: dto.currentPassword,
        newPassword: dto.newPassword,
        revokeOtherSessions: true,
      },
      returnHeaders: true,
    });
    const envelope = apiCall as unknown as { headers?: Headers };
    this.appendCookies(res, this.setCookieHeaders(envelope.headers));

    // Revoke all trusted browsers when password changes
    if (session?.user?.id) {
      await this.trustedBrowserService.revokeAllForUser(session.user.id);
      await this.adminStepUpService.clearForUser(session.user.id);
      this.clearCookie(res, TRUSTED_BROWSER_COOKIE);
    }

    return { message: 'Password changed successfully' };
  }

  // ─── Get Session ───────────────────────────────────────────────────────────

  @Get('session')
  @Optional()
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get current session',
    description: 'Returns the current authenticated session info',
  })
  @ApiResponse({ status: 200, description: 'Current session data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSession(
    @Session() session: UserSession<typeof auth> | BetterAuthSession | null,
    @Req() req: Request,
  ) {
    req.res?.setHeader('Cache-Control', 'private, no-store');

    const challenge = await this.preAuthService.findChallenge(
      readCookie(req, PRE_AUTH_COOKIE),
    );
    if (challenge) {
      const user = await this.preAuthService.getUserSnapshot(challenge.userId);
      if (user) {
        return {
          session: null,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            enrollmentComplete: challenge.state !== 'ENROLLMENT',
            ...(await this.imageReadService.describeEmployeePhotoByUserId(
              user.id,
            )),
          },
          twoFactorRequired: challenge.state === 'TOTP',
        };
      }
    }

    if (!session) return { session: null };
    const sessionObj = 'session' in session ? session.session : session;
    const userObj = 'user' in session ? session.user : null;
    if (
      userObj &&
      this.twoFactorService.requiresTwoFactor(userObj.role ?? '') &&
      !(await this.twoFactorService.hasCompletedEnrollment(userObj.id))
    ) {
      await auth.api.signOut({
        headers: this.toHeaders(req),
        returnHeaders: true,
      });
      this.clearSessionCookies(req, req.res);
      return { session: null };
    }
    const expiryWindow = (
      req as Request & {
        sessionExpiryWindow?: SessionExpiryWindow;
      }
    ).sessionExpiryWindow;
    return {
      session: {
        id: sessionObj.id,
        expiresAt: expiryWindow?.expiresAt ?? sessionObj.expiresAt,
        userId: sessionObj.userId,
        idleExpiresAt: expiryWindow?.idleExpiresAt ?? sessionObj.expiresAt,
        absoluteExpiresAt:
          expiryWindow?.absoluteExpiresAt ?? sessionObj.expiresAt,
      },
      ...(userObj
        ? {
            user: {
              id: userObj.id,
              email: userObj.email,
              role: userObj.role,
              name: userObj.name,
              enrollmentComplete:
                await this.twoFactorService.hasCompletedEnrollment(userObj.id),
              ...(await this.imageReadService.describeEmployeePhotoByUserId(
                userObj.id,
              )),
            },
          }
        : {}),
    };
  }
  // ─── Get CSRF Token ────────────────────────────────────────────────────────

  @Get('csrf')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get CSRF token',
    description:
      'Returns a CSRF token for the current context (anonymous, pre-auth, or authenticated)',
  })
  @ApiResponse({
    status: 200,
    description: 'CSRF token issued',
    schema: {
      example: {
        csrfToken: 'abc123...',
      },
    },
  })
  getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = csrfCookieName();
    const existingToken = readCookie(req, cookieName);
    const csrfToken = isCsrfToken(existingToken, req.headers.cookie)
      ? existingToken
      : createCsrfToken(req.headers.cookie);

    res.cookie(cookieName, csrfToken, {
      httpOnly: true,
      secure: isSecureCookie(),
      sameSite: 'strict',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    });
    res.setHeader('Cache-Control', 'no-store');

    return { csrfToken };
  }

  @Post('2fa/enable')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start mandatory 2FA enrollment' })
  @ApiBody({ type: EnableTwoFactorDto })
  async enableTwoFactor(@Body() dto: EnableTwoFactorDto, @Req() req: Request) {
    const challenge = await this.requirePreAuth(req, 'ENROLLMENT');
    const user = await this.preAuthService.getUserSnapshot(challenge.userId);
    if (!user) throw new UnauthorizedException('User not found');
    if (!(await this.twoFactorService.verifyPassword(user.id, dto.password))) {
      throw new BadRequestException({
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect',
      });
    }
    const generated = await this.twoFactorService.generateSecret(
      user.id,
      user.email,
    );
    return { totpURI: generated.qrCodeUrl };
  }

  @Post('2fa/verify-setup')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify authenticator setup and issue recovery codes',
  })
  @ApiBody({ type: VerifyChallengeCodeDto })
  async verifyTwoFactorSetup(
    @Body() dto: VerifyChallengeCodeDto,
    @Req() req: Request,
  ) {
    const challenge = await this.requirePreAuth(req, 'ENROLLMENT');
    return this.twoFactorService.verifyPendingEnrollment(
      challenge.userId,
      dto.code,
    );
  }

  @Post('2fa/acknowledge-recovery-codes')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finish mandatory 2FA enrollment' })
  @ApiBody({ type: AcknowledgeRecoveryCodesDto })
  async acknowledgeRecoveryCodes(
    @Body() dto: AcknowledgeRecoveryCodesDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const challenge = await this.requirePreAuth(req, 'ENROLLMENT');
    if (dto.acknowledged !== true) {
      throw new BadRequestException({
        code: 'RECOVERY_CODES_NOT_ACKNOWLEDGED',
        message: 'Confirm that you saved your recovery codes',
      });
    }
    await this.twoFactorService.confirmBackupCodesSaved(challenge.userId);
    const completed = await this.preAuthService.completeChallenge(
      readCookie(req, PRE_AUTH_COOKIE),
    );
    if (!completed || completed.state !== 'ENROLLMENT') {
      throw this.invalidPreAuthState('NOT_IN_PRE_AUTH_OR_STEP_UP');
    }
    const user = await this.preAuthService.getUserSnapshot(completed.userId);
    if (!user) throw new UnauthorizedException('User not found');
    this.appendCookies(res, completed.sessionCookies);
    this.clearCookie(res, PRE_AUTH_COOKIE);
    return {
      enrollmentComplete: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.firstname,
      },
    };
  }

  @Post('2fa/verify-totp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify TOTP during mandatory-role sign-in' })
  @ApiBody({ type: VerifyChallengeCodeDto })
  async verifyTotpAtSignIn(
    @Body() dto: VerifyChallengeCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const challenge = await this.requirePreAuth(req, 'TOTP');
    const result = await this.twoFactorService.verifyToken(
      challenge.userId,
      dto.code,
    );
    if (!result.success) {
      throw new BadRequestException({
        code: 'INVALID_TOTP_CODE',
        message: 'Invalid authenticator code',
        attemptsRemaining: result.attemptsRemaining ?? 0,
      });
    }
    return this.finishPreAuthLogin(
      req,
      res,
      challenge,
      dto.trustBrowser === true,
      false,
    );
  }

  @Post('2fa/verify-recovery-code')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a recovery code during sign-in' })
  @ApiBody({ type: VerifyChallengeCodeDto })
  async verifyRecoveryCodeAtSignIn(
    @Body() dto: VerifyChallengeCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const challenge = await this.requirePreAuth(req, 'TOTP');
    const result = await this.twoFactorService.verifyToken(
      challenge.userId,
      dto.code,
    );
    if (!result.success) {
      throw new BadRequestException({
        code: 'INVALID_RECOVERY_CODE',
        message: 'Invalid or previously used recovery code',
        attemptsRemaining: result.attemptsRemaining ?? 0,
      });
    }
    return this.finishPreAuthLogin(
      req,
      res,
      challenge,
      dto.trustBrowser === true,
      true,
    );
  }
  // ─── 2FA: Generate Secret ──────────────────────────────────────────────────

  @Post('2fa/generate-secret')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Generate 2FA secret',
    description:
      'Generate TOTP secret and QR code URL for authenticator app enrollment',
  })
  @ApiResponse({
    status: 200,
    description: 'Secret generated',
    schema: {
      example: {
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeUrl:
          'otpauth://totp/HAMS:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=HAMS',
      },
    },
  })
  @ApiResponse({ status: 400, description: '2FA already enrolled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateTwoFactorSecret(
    @Session() session: UserSession<typeof auth> | null,
  ) {
    const user = session?.user;
    if (!user) {
      throw new UnauthorizedException('No active session');
    }

    return this.twoFactorService.generateSecret(user.id, user.email);
  }

  // ─── 2FA: Verify and Enroll ────────────────────────────────────────────────

  @Post('2fa/verify-enrollment')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Verify TOTP and complete enrollment',
    description: 'Verify TOTP code and receive backup codes (shown once)',
  })
  @ApiBody({ type: VerifyEnrollmentDto })
  @ApiResponse({
    status: 200,
    description: 'Enrollment verified, backup codes issued',
    schema: {
      example: {
        backupCodes: [
          'A1B2C3D4',
          'E5F6G7H8',
          // ... 10 codes total
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid TOTP code' })
  async verifyTwoFactorEnrollment(
    @Body() dto: VerifyEnrollmentDto,
    @Session() session: UserSession<typeof auth> | null,
  ) {
    const user = session?.user;
    if (!user) {
      throw new UnauthorizedException('No active session');
    }

    return this.twoFactorService.verifyAndEnroll(
      user.id,
      dto.secret,
      dto.token,
    );
  }

  // ─── 2FA: Confirm Backup Codes Saved ───────────────────────────────────────

  @Post('2fa/confirm-backup-codes')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Confirm backup codes saved',
    description:
      'User confirms they have saved backup codes - completes enrollment',
  })
  @ApiBody({ type: ConfirmBackupCodesDto })
  @ApiResponse({ status: 200, description: 'Enrollment complete' })
  async confirmBackupCodesSaved(
    @Body() dto: ConfirmBackupCodesDto,
    @Session() session: UserSession<typeof auth> | null,
  ) {
    const user = session?.user;
    if (!user) throw new UnauthorizedException('No active session');
    if (!dto.confirmed) {
      throw new BadRequestException('Must confirm backup codes are saved');
    }
    await this.twoFactorService.confirmBackupCodesSaved(user.id);
    return { message: '2FA enrollment complete' };
  }

  // ─── 2FA: Get Enrollment Status ────────────────────────────────────────────

  @Get('2fa/status')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get 2FA enrollment status',
    description: 'Check if current user has completed 2FA enrollment',
  })
  @ApiResponse({
    status: 200,
    description: '2FA status',
    schema: { example: { enrolled: true, required: true } },
  })
  async getTwoFactorStatus(
    @Session() session: UserSession<typeof auth> | null,
  ) {
    const user = session?.user;
    if (!user) throw new UnauthorizedException('No active session');
    const enrolled = await this.twoFactorService.hasCompletedEnrollment(
      user.id,
    );
    return {
      enrolled,
      required: this.twoFactorService.requiresTwoFactor(user.role ?? ''),
    };
  }

  @Post('2fa/replace-authenticator')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Start replacing the current authenticator',
    description:
      'Requires the current password and TOTP; the new authenticator remains pending until verified',
  })
  @ApiBody({ type: ReplaceAuthenticatorDto })
  @ApiResponse({ status: 200, description: 'Pending authenticator created' })
  @ApiResponse({
    status: 400,
    description: 'Password or current TOTP is invalid',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async startAuthenticatorReplacement(
    @Body() dto: ReplaceAuthenticatorDto,
    @Req() req: Request,
    @Session() session: UserSession<typeof auth> | null,
  ): Promise<{ totpURI: string }> {
    const user = session?.user;
    if (!user) throw new UnauthorizedException('No active session');
    req.res?.setHeader('Cache-Control', 'no-store');

    const result = await this.twoFactorService.startAuthenticatorReplacement(
      user.id,
      user.email,
      dto.currentPassword,
      dto.currentTotpCode,
    );
    await this.adminStepUpService.clearForUser(user.id);
    return { totpURI: result.qrCodeUrl };
  }

  @Post('2fa/verify-authenticator-replacement')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Confirm a replacement authenticator',
    description:
      'Activates the pending authenticator only after its TOTP code is verified',
  })
  @ApiBody({ type: VerifyTotpCodeDto })
  @ApiResponse({ status: 200, description: 'Authenticator replaced' })
  @ApiResponse({ status: 400, description: 'Replacement code is invalid' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async verifyAuthenticatorReplacement(
    @Body() dto: VerifyTotpCodeDto,
    @Req() req: Request,
    @Session() session: UserSession<typeof auth> | null,
  ): Promise<{ message: string }> {
    const user = session?.user;
    if (!user) throw new UnauthorizedException('No active session');
    req.res?.setHeader('Cache-Control', 'no-store');

    await this.twoFactorService.completeAuthenticatorReplacement(
      user.id,
      dto.code,
    );
    await this.adminStepUpService.clearForUser(user.id);
    return { message: 'Authenticator replaced successfully' };
  }

  @Post('2fa/regenerate-recovery-codes')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Generate a new set of recovery codes',
    description:
      'Requires a current TOTP; the previous recovery codes are invalidated and new codes are returned once',
  })
  @ApiBody({ type: VerifyTotpCodeDto })
  @ApiResponse({ status: 200, description: 'New recovery codes shown once' })
  @ApiResponse({ status: 400, description: 'Current TOTP code is invalid' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async regenerateRecoveryCodes(
    @Body() dto: VerifyTotpCodeDto,
    @Req() req: Request,
    @Session() session: UserSession<typeof auth> | null,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = session?.user;
    if (!user) throw new UnauthorizedException('No active session');
    req.res?.setHeader('Cache-Control', 'no-store');

    const recoveryCodes = await this.twoFactorService.regenerateRecoveryCodes(
      user.id,
      dto.code,
    );
    await this.adminStepUpService.clearForUser(user.id);
    return { recoveryCodes };
  }

  @Post('step-up/totp')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Create a five-minute ADMIN Step-up window',
    description:
      'Requires the current ADMIN session and a fresh TOTP, including on a trusted browser',
  })
  @ApiBody({ type: VerifyTotpCodeDto })
  @ApiResponse({ status: 200, description: 'Five-minute Step-up granted' })
  @ApiResponse({
    status: 403,
    description: 'ADMIN access or valid TOTP required',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createAdminStepUp(
    @Body() dto: VerifyTotpCodeDto,
    @Req() req: Request,
    @Session() session: UserSession<typeof auth> | null,
  ): Promise<{ expiresAt: Date }> {
    const user = session?.user;
    const sessionId = session?.session?.id;
    if (!user || !sessionId) {
      throw new UnauthorizedException('No active session');
    }
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'ADMIN_STEP_UP_REQUIRED',
        message: 'Only an ADMIN can create an administrative Step-up',
      });
    }
    req.res?.setHeader('Cache-Control', 'no-store');
    return this.adminStepUpService.verifyAndGrant(user.id, sessionId, dto.code);
  }

  // ─── 2FA: Verify Token (Login) ────────────────────────────────────────────

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Verify 2FA token during login',
    description:
      'Verify TOTP or recovery code and optionally grant trusted browser for 14 days',
  })
  @ApiBody({ type: VerifyTwoFactorDto })
  @ApiResponse({
    status: 200,
    description: '2FA verified successfully',
    schema: {
      example: {
        success: true,
        usedRecoveryCode: false,
        trustedBrowserToken: 'abc123...',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Account locked due to failed attempts',
  })
  @ApiResponse({ status: 401, description: 'Invalid 2FA token' })
  async verifyTwoFactor(
    @Body() dto: VerifyTwoFactorDto,
    @Session() session: UserSession<typeof auth> | null,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const user = session?.user;
    if (!user) throw new UnauthorizedException('No active session');
    const result = await this.twoFactorService.verifyToken(user.id, dto.token);
    if (!result.success) {
      throw new UnauthorizedException('Invalid 2FA token');
    }

    if (dto.trustBrowser === true) {
      const userAgent = req.headers['user-agent'] || 'unknown';
      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown';
      const trustResult = await this.trustedBrowserService.grantTrust(
        user.id,
        Array.isArray(userAgent) ? userAgent[0] : userAgent,
        ipAddress,
        readCookie(req, TRUSTED_BROWSER_COOKIE),
      );
      this.setTrustedBrowserCookie(
        res,
        trustResult.token,
        trustResult.expiresAt,
      );
    }

    return {
      success: true,
      usedRecoveryCode: result.usedRecoveryCode === true,
      browserTrusted: dto.trustBrowser === true,
    };
  }
  // ─── Trusted Browser: Check Status ─────────────────────────────────────────

  @Get('trusted-browser/check')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Check if current browser is trusted',
    description:
      'Check if the current browser profile is trusted for this user',
  })
  @ApiResponse({
    status: 200,
    description: 'Trusted browser status',
    schema: { example: { trusted: true } },
  })
  async checkTrustedBrowser(
    @Session() session: UserSession<typeof auth> | null,
    @Req() req: Request,
  ) {
    const user = session?.user;
    if (!user) throw new UnauthorizedException('No active session');
    const result = await this.trustedBrowserService.isBrowserTrusted(
      user.id,
      readCookie(req, TRUSTED_BROWSER_COOKIE),
    );
    return { trusted: result.trusted };
  }
  // ─── Trusted Browser: List All ─────────────────────────────────────────

  @Get('trusted-browser/list')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'List all trusted browsers',
    description: 'Get all active trusted browsers for current user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of trusted browsers',
    schema: {
      example: {
        trustedBrowsers: [
          {
            id: 'cuid123',
            ipAddress: '192.168.1.1',
            grantedAt: '2026-09-25T10:00:00Z',
            expiresAt: '2026-10-09T10:00:00Z',
          },
        ],
      },
    },
  })
  async listTrustedBrowsers(
    @Session() session: UserSession<typeof auth> | null,
  ) {
    const user = session?.user;
    if (!user) {
      throw new UnauthorizedException('No active session');
    }

    const trustedBrowsers = await this.trustedBrowserService.getTrustedBrowsers(
      user.id,
    );

    return {
      trustedBrowsers,
    };
  }

  // ─── Trusted Browser: Revoke Specific ──────────────────────────────────

  @Post('trusted-browser/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Revoke a specific trusted browser',
    description: 'Revoke trust for a specific browser by token',
  })
  @ApiBody({ type: RevokeTrustDto })
  @ApiResponse({
    status: 200,
    description: 'Trusted browser revoked',
  })
  async revokeTrustedBrowser(
    @Body() dto: RevokeTrustDto,
    @Session() session: UserSession<typeof auth> | null,
  ) {
    const user = session?.user;
    if (!user) {
      throw new UnauthorizedException('No active session');
    }

    await this.trustedBrowserService.revokeTrustedBrowser(user.id, dto.token);

    return {
      message: 'Trusted browser revoked successfully',
    };
  }

  // ─── Trusted Browser: Revoke All ───────────────────────────────────────

  @Post('trusted-browser/revoke-all')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Revoke all trusted browsers',
    description: 'Revoke trust for all browsers for current user',
  })
  @ApiResponse({
    status: 200,
    description: 'All trusted browsers revoked',
  })
  async revokeAllTrustedBrowsers(
    @Session() session: UserSession<typeof auth> | null,
  ) {
    const user = session?.user;
    if (!user) {
      throw new UnauthorizedException('No active session');
    }

    await this.trustedBrowserService.revokeAllForUser(user.id);

    return {
      message: 'All trusted browsers revoked successfully',
    };
  }
  private toHeaders(req: Request): Headers {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    return headers;
  }

  private setCookieHeaders(headers?: Headers): string[] {
    if (!headers) return [];
    const extended = headers as Headers & { getSetCookie?: () => string[] };
    if (typeof extended.getSetCookie === 'function') {
      return extended.getSetCookie();
    }
    const cookie = headers.get('set-cookie');
    return cookie ? [cookie] : [];
  }

  private appendCookies(res: Response | undefined, cookies: string[]): void {
    if (!res) return;
    for (const cookie of cookies) res.append('Set-Cookie', cookie);
  }

  private setPreAuthCookie(
    res: Response | undefined,
    token: string,
    expiresAt: Date,
  ): void {
    if (!res) return;
    const maxAge = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
    );
    const secure = isSecureCookie() ? '; Secure' : '';
    res.append(
      'Set-Cookie',
      PRE_AUTH_COOKIE +
        '=' +
        token +
        '; Path=/; Max-Age=' +
        maxAge +
        '; HttpOnly; SameSite=Lax' +
        secure,
    );
  }

  private setTrustedBrowserCookie(
    res: Response | undefined,
    token: string,
    expiresAt: Date,
  ): void {
    if (!res) return;
    const maxAge = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
    );
    const secure = isSecureCookie() ? '; Secure' : '';
    res.append(
      'Set-Cookie',
      TRUSTED_BROWSER_COOKIE +
        '=' +
        token +
        '; Path=/; Max-Age=' +
        maxAge +
        '; Expires=' +
        expiresAt.toUTCString() +
        '; HttpOnly; SameSite=Lax' +
        secure,
    );
  }

  private clearCookie(res: Response | undefined, name: string): void {
    if (!res) return;
    const secure = isSecureCookie() ? '; Secure' : '';
    res.append(
      'Set-Cookie',
      name +
        '=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT' +
        '; HttpOnly; SameSite=Lax' +
        secure,
    );
  }

  private clearSessionCookies(req: Request, res?: Response): void {
    if (!res) return;
    const names = new Set([
      'better-auth.session_token',
      'better-auth.session_data',
      '__Secure-better-auth.session_token',
      '__Secure-better-auth.session_data',
    ]);
    for (const part of (req.headers.cookie ?? '').split(';')) {
      const name = part.split('=', 1)[0]?.trim();
      if (name && /better-auth\.session_(?:token|data)(?:\.\d+)?$/.test(name)) {
        names.add(name);
      }
    }
    for (const name of names) this.clearCookie(res, name);
  }

  private async requirePreAuth(req: Request, expectedState: PreAuthState) {
    const challenge = await this.preAuthService.findChallenge(
      readCookie(req, PRE_AUTH_COOKIE),
    );
    if (!challenge) {
      throw this.invalidPreAuthState(
        expectedState === 'ENROLLMENT'
          ? 'NOT_IN_PRE_AUTH_OR_STEP_UP'
          : 'NOT_IN_TOTP_VERIFICATION_STATE',
      );
    }
    if (challenge.state !== expectedState) {
      throw this.invalidPreAuthState(
        expectedState === 'ENROLLMENT'
          ? 'NOT_IN_PRE_AUTH_OR_STEP_UP'
          : 'NOT_IN_TOTP_VERIFICATION_STATE',
      );
    }
    return challenge;
  }

  private invalidPreAuthState(code: string): ForbiddenException {
    return new ForbiddenException({
      code,
      message: 'This operation is unavailable in the current sign-in state',
      statusCode: 403,
    });
  }

  private async finishPreAuthLogin(
    req: Request,
    res: Response | undefined,
    challenge: { id: string; userId: string; state: PreAuthState },
    trustBrowser: boolean,
    usedRecoveryCode: boolean,
  ) {
    const completed = await this.preAuthService.completeChallenge(
      readCookie(req, PRE_AUTH_COOKIE),
    );
    if (
      !completed ||
      completed.userId !== challenge.userId ||
      completed.state !== challenge.state
    ) {
      throw this.invalidPreAuthState('NOT_IN_TOTP_VERIFICATION_STATE');
    }

    const user = await this.preAuthService.getUserSnapshot(completed.userId);
    if (!user) throw new UnauthorizedException('User not found');

    if (trustBrowser) {
      const userAgent = req.get('user-agent') || 'unknown';
      const ipAddress =
        req.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        'unknown';
      const grant = await this.trustedBrowserService.grantTrust(
        user.id,
        userAgent,
        ipAddress,
        readCookie(req, TRUSTED_BROWSER_COOKIE),
      );
      this.setTrustedBrowserCookie(res, grant.token, grant.expiresAt);
    }

    this.appendCookies(res, completed.sessionCookies);
    this.clearCookie(res, PRE_AUTH_COOKIE);
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.firstname,
      },
      browserTrusted: trustBrowser,
      usedRecoveryCode,
    };
  }
}
