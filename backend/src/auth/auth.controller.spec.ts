import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Session as BetterAuthSession } from 'better-auth/types';
import { AuthController } from './auth.controller';
import { auth } from './auth';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── Sign In ───────────────────────────────────────────────────────────────
  describe('signIn', () => {
    it('should return session token and user when credentials are valid', async () => {
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
        token: 'valid-jwt-token',
        user: {
          id: 'user-uuid-1',
          email: 'admin@hospital.go.th',
          name: 'สมชาย แอดมินระบบ',
        },
      });
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

    it('should throw UnauthorizedException when sign-in fails with generic error', async () => {
      mockSignInEmail.mockRejectedValue(new Error('Invalid email or password'));

      const dto = { email: 'wrong@hospital.go.th', password: 'wrong' };
      await expect(controller.signIn(dto, mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
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
      mockChangePassword.mockResolvedValue({
        token: 'new-token',
      });

      const dto = {
        currentPassword: 'OldPassword@1234',
        newPassword: 'NewPassword@1234',
      };

      const result = await controller.changePassword(dto, mockRequest);

      expect(mockChangePassword).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            currentPassword: dto.currentPassword,
            newPassword: dto.newPassword,
            revokeOtherSessions: true,
          },
        }),
      );
      expect(result).toEqual({
        message: 'Password changed successfully',
        token: 'new-token',
      });
    });
  });

  // ─── Get Session ───────────────────────────────────────────────────────────
  describe('getSession', () => {
    it('should return session details', () => {
      const session: BetterAuthSession = {
        id: 'session-id-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
        token: 'mock-session-token',
        userId: 'user-uuid-1',
      };

      const result = controller.getSession(session);

      expect(result).toEqual({
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
          userId: session.userId,
        },
      });
    });
  });
});
