import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { Session as BetterAuthSession } from 'better-auth/types';
import { AuthController } from './auth.controller';
import { TwoFactorService } from './two-factor.service';
import { TrustedBrowserService } from './trusted-browser.service';
import { PreAuthService } from './pre-auth.service';
import { AdminStepUpService } from './admin-step-up.service';
import { auth } from './auth';
import { ImageReadService } from '../images/image-read.service';

// ─── Mock Better Auth ────────────────────────────────────────────────────────
jest.mock('./auth', () => ({
  auth: {
    api: {
      signInEmail: jest.fn(),
      signOut: jest.fn(),
      changePassword: jest.fn(),
      sendVerificationEmail: jest.fn(),
    },
  },
}));

describe('AuthController', () => {
  let controller: AuthController;

  const mockSignInEmail = auth.api.signInEmail as unknown as jest.Mock;
  const mockSignOut = auth.api.signOut as unknown as jest.Mock;
  const mockChangePassword = auth.api.changePassword as unknown as jest.Mock;
  const mockSendVerificationEmail = auth.api
    .sendVerificationEmail as unknown as jest.Mock;

  const mockRequest = {
    headers: {
      'user-agent': 'jest-test-agent',
      authorization: 'Bearer mock-token',
    },
  } as unknown as Request;

  const mockTwoFactorService = {
    requiresTwoFactor: jest.fn(),
    hasCompletedEnrollment: jest.fn(),
    generateSecret: jest.fn(),
    verifyAndEnroll: jest.fn(),
    confirmBackupCodesSaved: jest.fn(),
    verifyToken: jest.fn(),
    startAuthenticatorReplacement: jest.fn(),
    completeAuthenticatorReplacement: jest.fn(),
    regenerateRecoveryCodes: jest.fn(),
  };

  const mockTrustedBrowserService = {
    resolveTrustForSignIn: jest.fn(),
    grantTrust: jest.fn(),
    isBrowserTrusted: jest.fn(),
    getTrustedBrowsers: jest.fn(),
    revokeTrustedBrowser: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const mockPreAuthService = {
    findChallenge: jest.fn(),
    getUserSnapshot: jest.fn(),
    createChallenge: jest.fn(),
    completeChallenge: jest.fn(),
    cancelChallenge: jest.fn(),
  };
  const mockAdminStepUpService = {
    clearForUser: jest.fn(),
    verifyAndGrant: jest.fn(),
  };
  const mockImageReadService = {
    describeEmployeePhotoByUserId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: TwoFactorService,
          useValue: mockTwoFactorService,
        },
        {
          provide: TrustedBrowserService,
          useValue: mockTrustedBrowserService,
        },
        {
          provide: PreAuthService,
          useValue: mockPreAuthService,
        },
        {
          provide: AdminStepUpService,
          useValue: mockAdminStepUpService,
        },
        { provide: ImageReadService, useValue: mockImageReadService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
    mockPreAuthService.findChallenge.mockResolvedValue(null);
    mockPreAuthService.getUserSnapshot.mockResolvedValue({
      id: 'user-uuid-1',
      email: 'admin@hospital.go.th',
      firstname: 'สมชาย แอดมินระบบ',
      role: 'DEPARTMENT_STAFF',
    });
    mockImageReadService.describeEmployeePhotoByUserId.mockResolvedValue({
      hasEmployeePhoto: false,
      photoRevision: null,
    });
    mockTrustedBrowserService.resolveTrustForSignIn.mockResolvedValue({
      trusted: false,
      revokedOtherUser: false,
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── Sign In ───────────────────────────────────────────────────────────────
  describe('signIn', () => {
    it('returns the user without exposing the session token', async () => {
      const mockResult = {
        token: 'valid-jwt-token',
        user: {
          id: 'user-uuid-1',
          email: 'admin@hospital.go.th',
          name: 'สมชาย แอดมินระบบ',
        },
      };

      mockSignInEmail.mockResolvedValue(mockResult);

      const dto = { email: 'admin@hospital.go.th', password: 'Password@1234' };
      const response = await controller.signIn(dto, mockRequest);

      expect(mockSignInEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { email: dto.email, password: dto.password },
        }),
      );
      expect(response).toEqual({
        user: {
          id: 'user-uuid-1',
          email: 'admin@hospital.go.th',
          name: 'สมชาย แอดมินระบบ',
          role: 'DEPARTMENT_STAFF',
        },
      });
      expect(JSON.stringify(response)).not.toContain('valid-jwt-token');
    });

    it('should throw UnauthorizedException when no token is returned', async () => {
      mockSignInEmail.mockResolvedValue({ token: null });

      const dto = { email: 'user@hospital.go.th', password: 'WrongPassword' };
      await expect(controller.signIn(dto, mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException when email is not verified (status 403 / EMAIL_NOT_VERIFIED)', async () => {
      const verificationError = {
        status: 403,
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email not verified',
      };
      mockSignInEmail.mockRejectedValue(verificationError);

      const dto = {
        email: 'unverified@hospital.go.th',
        password: 'Password@1234',
      };

      try {
        await controller.signIn(dto, mockRequest);
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const forbiddenErr = err as ForbiddenException;
        const res = forbiddenErr.getResponse() as Record<string, unknown>;
        expect(res).toEqual(
          expect.objectContaining({
            code: 'EMAIL_NOT_VERIFIED',
            message:
              'อีเมลยังไม่ได้รับการยืนยัน กรุณาตรวจสอบกล่องข้อความอีเมลของคุณ',
          }),
        );
      }
    });

    it('should throw UnauthorizedException when Better Auth rejects credentials', async () => {
      mockSignInEmail.mockRejectedValue({
        status: 'UNAUTHORIZED',
        statusCode: 401,
        body: { code: 'INVALID_EMAIL_OR_PASSWORD' },
      });

      const dto = { email: 'wrong@hospital.go.th', password: 'wrong' };
      await expect(controller.signIn(dto, mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('does not report a post-password server failure as wrong credentials', async () => {
      mockSignInEmail.mockResolvedValue({
        response: {
          token: 'pending-session',
          user: {
            id: 'admin-1',
            email: 'admin@hospital.go.th',
            role: 'ADMIN',
          },
        },
        headers: {
          getSetCookie: () => [
            'better-auth.session_token=pending-session; Path=/; HttpOnly',
          ],
        },
      });
      mockTwoFactorService.requiresTwoFactor.mockReturnValue(true);
      mockTwoFactorService.hasCompletedEnrollment.mockResolvedValue(false);
      mockPreAuthService.createChallenge.mockRejectedValue(
        new Error('Pre-auth storage failed'),
      );

      await expect(
        controller.signIn(
          { email: 'admin@hospital.go.th', password: 'Password@1234' },
          mockRequest,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('mandatory-role sign-in and trusted browser', () => {
    it('keeps the normal session pending until mandatory enrollment completes', async () => {
      const sessionCookie =
        'better-auth.session_token=pending-session; Path=/; HttpOnly';
      mockSignInEmail.mockResolvedValue({
        response: {
          token: 'pending-session',
          user: {
            id: 'admin-1',
            email: 'admin@hospital.go.th',
            name: 'Admin',
            role: 'ADMIN',
          },
        },
        headers: { getSetCookie: () => [sessionCookie] },
      });
      mockTwoFactorService.requiresTwoFactor.mockReturnValue(true);
      mockTwoFactorService.hasCompletedEnrollment.mockResolvedValue(false);
      mockPreAuthService.createChallenge.mockResolvedValue({
        token: 'opaque-pre-auth-token',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      const response = { append: jest.fn() } as unknown as Response;

      const result = await controller.signIn(
        { email: 'admin@hospital.go.th', password: 'Password@1234' },
        mockRequest,
        response,
      );

      expect(result).toEqual({
        requiresTwoFactor: true,
        twoFactorRedirect: '/2fa/enroll',
      });
      expect(result).not.toHaveProperty('token');
      expect(mockPreAuthService.createChallenge).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          state: 'ENROLLMENT',
          sessionToken: 'pending-session',
          sessionCookies: [sessionCookie],
        }),
      );
      const setCookies = (response.append as jest.Mock).mock.calls.map(
        (call) => call[1] as string,
      );
      expect(
        setCookies.some(
          (cookie) =>
            cookie.startsWith('hams.pre_auth=') && cookie.includes('HttpOnly'),
        ),
      ).toBe(true);
      expect(
        setCookies.some(
          (cookie) =>
            cookie.startsWith('better-auth.session_token=') &&
            cookie.includes('Max-Age=0'),
        ),
      ).toBe(true);
    });

    it('issues trust only after successful TOTP and keeps the cookie out of JSON', async () => {
      const now = Date.now();
      const requestWithChallenge = {
        headers: {
          cookie:
            'hams.pre_auth=challenge-token; better-auth.trust_device=old-token',
          'user-agent': 'Chrome test browser',
        },
        get: (name: string) =>
          name.toLowerCase() === 'user-agent'
            ? 'Chrome test browser'
            : undefined,
        ip: '192.0.2.1',
        socket: { remoteAddress: '192.0.2.2' },
      } as unknown as Request;
      mockPreAuthService.findChallenge.mockResolvedValue({
        id: 'challenge-id',
        userId: 'admin-1',
        state: 'TOTP',
      });
      mockTwoFactorService.verifyToken.mockResolvedValue({
        success: true,
        usedRecoveryCode: false,
      });
      mockPreAuthService.completeChallenge.mockResolvedValue({
        userId: 'admin-1',
        state: 'TOTP',
        sessionCookies: [
          'better-auth.session_token=normal-session; Path=/; HttpOnly',
        ],
      });
      mockPreAuthService.getUserSnapshot.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@hospital.go.th',
        firstname: 'Admin',
        role: 'ADMIN',
      });
      mockTrustedBrowserService.grantTrust.mockResolvedValue({
        token: 'new-opaque-trust-cookie',
        expiresAt: new Date(now + 14 * 24 * 60 * 60 * 1000),
      });
      const response = { append: jest.fn() } as unknown as Response;

      const result = await controller.verifyTotpAtSignIn(
        { code: '123456', trustBrowser: true },
        requestWithChallenge,
        response,
      );

      expect(result).toEqual({
        user: {
          id: 'admin-1',
          email: 'admin@hospital.go.th',
          role: 'ADMIN',
          name: 'Admin',
        },
        browserTrusted: true,
        usedRecoveryCode: false,
      });
      expect(result).not.toHaveProperty('token');
      expect(result).not.toHaveProperty('trustedBrowserToken');
      expect(mockTrustedBrowserService.grantTrust).toHaveBeenCalledWith(
        'admin-1',
        'Chrome test browser',
        '192.0.2.1',
        'old-token',
      );
      const setCookies = (response.append as jest.Mock).mock.calls.map(
        (call) => call[1] as string,
      );
      expect(
        setCookies.some(
          (cookie) =>
            cookie.startsWith(
              'better-auth.trust_device=new-opaque-trust-cookie',
            ) &&
            cookie.includes('HttpOnly') &&
            cookie.includes('Max-Age=1209600'),
        ),
      ).toBe(true);
      expect(
        setCookies.some((cookie) =>
          cookie.startsWith('better-auth.session_token=normal-session'),
        ),
      ).toBe(true);
    });
  });
  // ─── Send Verification Email (Resend) ──────────────────────────────────────
  describe('sendVerificationEmail', () => {
    it('should send verification email successfully', async () => {
      mockSendVerificationEmail.mockResolvedValue({
        status: true,
      });

      const dto = {
        email: 'user@hospital.go.th',
        callbackURL: 'http://localhost:5173/login?verified=true',
      };

      const result = await controller.sendVerificationEmail(dto, mockRequest);

      expect(mockSendVerificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            email: dto.email,
            callbackURL: dto.callbackURL,
          },
        }),
      );
      expect(result).toEqual({
        status: true,
        message: 'Verification email sent successfully',
      });
    });

    it('should throw BadRequestException when Better Auth returns 400 error', async () => {
      const badRequestError = {
        status: 400,
        statusCode: 400,
        body: { message: 'Email already verified' },
      };
      mockSendVerificationEmail.mockRejectedValue(badRequestError);

      const dto = { email: 'already-verified@hospital.go.th' };
      await expect(
        controller.sendVerificationEmail(dto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Sign Out ──────────────────────────────────────────────────────────────
  describe('signOut', () => {
    it('should call auth.api.signOut and return success message', async () => {
      mockSignOut.mockResolvedValue({});

      const result = await controller.signOut(mockRequest);

      expect(mockSignOut).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Signed out successfully' });
    });
  });

  // ─── Change Password ───────────────────────────────────────────────────────
  describe('changePassword', () => {
    it('should call auth.api.changePassword and return success', async () => {
      const headers = new Headers();
      headers.append(
        'set-cookie',
        'better-auth.session_token=new-session; Path=/; HttpOnly',
      );
      mockChangePassword.mockResolvedValue({
        response: { token: 'new-token', user: { id: 'user-123' } },
        headers,
      });

      const dto = {
        currentPassword: 'OldPassword@1234',
        newPassword: 'NewPassword@1234',
      };

      const mockSession = {
        user: { id: 'user-123' },
      };
      const response = { append: jest.fn() } as unknown as Response;

      const result = await controller.changePassword(
        dto,
        mockRequest,
        response,
        mockSession as any,
      );

      expect(mockChangePassword).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            currentPassword: dto.currentPassword,
            newPassword: dto.newPassword,
            revokeOtherSessions: true,
          },
          returnHeaders: true,
        }),
      );
      expect(response.append).toHaveBeenCalledWith(
        'Set-Cookie',
        'better-auth.session_token=new-session; Path=/; HttpOnly',
      );
      expect(mockTrustedBrowserService.revokeAllForUser).toHaveBeenCalledWith(
        'user-123',
      );
      expect(result).toEqual({
        message: 'Password changed successfully',
      });
      expect(JSON.stringify(result)).not.toContain('new-token');
    });
  });

  describe('self-service 2FA security', () => {
    const session = {
      user: {
        id: 'user-uuid-1',
        email: 'admin@hospital.go.th',
        role: 'ADMIN',
      },
    } as any;
    const request = {
      ...mockRequest,
      res: { setHeader: jest.fn() },
    } as unknown as Request;

    it('always verifies the current password and TOTP for authenticator replacement', async () => {
      mockTwoFactorService.startAuthenticatorReplacement.mockResolvedValue({
        qrCodeUrl: 'otpauth://totp/HAMS:test?secret=TEST',
      });

      await expect(
        controller.startAuthenticatorReplacement(
          { currentPassword: 'current-password', currentTotpCode: '123456' },
          request,
          session,
        ),
      ).resolves.toEqual({
        totpURI: 'otpauth://totp/HAMS:test?secret=TEST',
      });

      expect(
        mockTwoFactorService.startAuthenticatorReplacement,
      ).toHaveBeenCalledWith(
        'user-uuid-1',
        'admin@hospital.go.th',
        'current-password',
        '123456',
      );
      expect(mockTrustedBrowserService.isBrowserTrusted).not.toHaveBeenCalled();
    });

    it('always verifies the current TOTP when regenerating recovery codes', async () => {
      mockTwoFactorService.regenerateRecoveryCodes.mockResolvedValue([
        'CODE-ONE',
      ]);

      await expect(
        controller.regenerateRecoveryCodes(
          { code: '654321' },
          request,
          session,
        ),
      ).resolves.toEqual({ recoveryCodes: ['CODE-ONE'] });

      expect(mockTwoFactorService.regenerateRecoveryCodes).toHaveBeenCalledWith(
        'user-uuid-1',
        '654321',
      );
      expect(mockTrustedBrowserService.isBrowserTrusted).not.toHaveBeenCalled();
      expect(request.res?.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store',
      );
    });
  });

  // ─── Get Session ───────────────────────────────────────────────────────────
  describe('getSession', () => {
    it('should return session details', async () => {
      const session: BetterAuthSession = {
        id: 'session-id-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
        token: 'mock-session-token',
        userId: 'user-uuid-1',
      };

      const expiryWindow = {
        expiresAt: new Date('2026-09-25T01:00:00.000Z'),
        idleExpiresAt: new Date('2026-09-25T01:00:00.000Z'),
        absoluteExpiresAt: new Date('2026-09-25T12:00:00.000Z'),
      };
      const mockReqWithRes = {
        ...mockRequest,
        sessionExpiryWindow: expiryWindow,
        res: {
          setHeader: jest.fn(),
        },
      } as unknown as Request;

      const result = await controller.getSession(session, mockReqWithRes);

      expect(mockReqWithRes.res?.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-store',
      );
      expect(result).toEqual({
        session: {
          id: session.id,
          expiresAt: expiryWindow.expiresAt,
          userId: session.userId,
          idleExpiresAt: expiryWindow.idleExpiresAt,
          absoluteExpiresAt: expiryWindow.absoluteExpiresAt,
        },
      });
    });

    it('returns only the employee photo descriptor in the authenticated session', async () => {
      mockTwoFactorService.requiresTwoFactor.mockReturnValue(false);
      mockImageReadService.describeEmployeePhotoByUserId.mockResolvedValue({
        hasEmployeePhoto: true,
        photoRevision: 'opaque-revision',
      });
      const session: UserSession<typeof auth> = {
        session: {
          id: 'session-id',
          expiresAt: new Date('2026-10-03T12:00:00.000Z'),
          createdAt: new Date('2026-10-03T10:00:00.000Z'),
          updatedAt: new Date('2026-10-03T10:00:00.000Z'),
          token: 'mock-session-token',
          userId: 'user-uuid-1',
        },
        user: {
          id: 'user-uuid-1',
          email: 'admin@hospital.go.th',
          emailVerified: true,
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          updatedAt: new Date('2026-10-01T00:00:00.000Z'),
          role: 'ADMIN',
          name: 'System Admin',
          image: null,
        },
      };

      const result = await controller.getSession(session, mockRequest);

      expect(result).toEqual(
        expect.objectContaining({
          user: expect.objectContaining({
            hasEmployeePhoto: true,
            photoRevision: 'opaque-revision',
          }),
        }),
      );
      expect(JSON.stringify(result)).not.toContain('url');
      expect(
        mockImageReadService.describeEmployeePhotoByUserId,
      ).toHaveBeenCalledWith('user-uuid-1');
    });

    it('revokes a legacy un-enrolled mandatory-role session', async () => {
      mockTwoFactorService.requiresTwoFactor.mockReturnValue(true);
      mockTwoFactorService.hasCompletedEnrollment.mockResolvedValue(false);
      mockSignOut.mockResolvedValue({});

      const session = {
        session: {
          id: 'legacy-session',
          expiresAt: new Date(),
          userId: 'user-uuid-1',
        },
        user: {
          id: 'user-uuid-1',
          email: 'admin@hospital.go.th',
          role: 'ADMIN',
        },
      } as any;
      const response = {
        setHeader: jest.fn(),
        append: jest.fn(),
      };
      const req = {
        headers: { cookie: 'better-auth.session_token=legacy-token' },
        res: response,
      } as unknown as Request;

      await expect(controller.getSession(session, req)).resolves.toEqual({
        session: null,
      });
      expect(mockSignOut).toHaveBeenCalledWith(
        expect.objectContaining({ returnHeaders: true }),
      );
      expect(response.append).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining(
          'better-auth.session_token=; Path=/; Max-Age=0',
        ),
      );
    });
  });
});
