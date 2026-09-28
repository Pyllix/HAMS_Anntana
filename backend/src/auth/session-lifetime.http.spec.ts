import {
  Controller,
  Get,
  INestApplication,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import type { Server } from 'http';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { SessionLifetimeGuard } from './session-lifetime.guard';
import {
  SessionLifetimeService,
  type SessionExpiryWindow,
} from './session-lifetime.service';

@Controller('auth')
@UseGuards(SessionLifetimeGuard)
class SessionWindowProbeController {
  @Get('session')
  getSession(
    @Req() req: Request & { sessionExpiryWindow?: SessionExpiryWindow },
  ) {
    return { session: req.sessionExpiryWindow ?? null };
  }

  @Post('protected-write')
  saveProtectedChange() {
    return { saved: true };
  }
}

describe('SessionLifetimeGuard HTTP behavior', () => {
  let app: INestApplication;
  const service = { enforceSession: jest.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [SessionWindowProbeController],
      providers: [
        SessionLifetimeGuard,
        {
          provide: SessionLifetimeService,
          useValue: service,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('returns the authoritative server deadline window for a cookie request', async () => {
    const window = {
      expiresAt: new Date('2026-09-25T01:00:00.000Z'),
      idleExpiresAt: new Date('2026-09-25T01:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-09-25T12:00:00.000Z'),
    };
    service.enforceSession.mockResolvedValue(window);

    await request(app.getHttpServer() as Server)
      .get('/auth/session')
      .set('Cookie', 'better-auth.session_token=session-token.signature')
      .set('X-User-Activity', '1')
      .expect(200)
      .expect({
        session: {
          expiresAt: window.expiresAt.toISOString(),
          idleExpiresAt: window.idleExpiresAt.toISOString(),
          absoluteExpiresAt: window.absoluteExpiresAt.toISOString(),
        },
      });

    expect(service.enforceSession).toHaveBeenCalledWith('session-token', true);
  });

  it('includes server deadlines in the authenticated session response', async () => {
    const window = {
      expiresAt: new Date('2026-09-25T01:00:00.000Z'),
      idleExpiresAt: new Date('2026-09-25T01:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-09-25T12:00:00.000Z'),
    };
    const controller = Object.assign(Object.create(AuthController.prototype), {
      preAuthService: { findChallenge: jest.fn().mockResolvedValue(null) },
    }) as AuthController;
    const session = {
      session: {
        id: 'session-id',
        expiresAt: window.expiresAt,
        userId: 'user-id',
      },
    };
    const req = {
      headers: {},
      sessionExpiryWindow: window,
      res: { setHeader: jest.fn() },
    } as unknown as Request;

    await expect(
      controller.getSession(
        session as Parameters<AuthController['getSession']>[0],
        req,
      ),
    ).resolves.toEqual({
      session: {
        id: 'session-id',
        expiresAt: window.expiresAt,
        idleExpiresAt: window.idleExpiresAt,
        absoluteExpiresAt: window.absoluteExpiresAt,
        userId: 'user-id',
      },
    });
  });
  it("blocks a protected write over HTTP when the session is expired", async () => {
    service.enforceSession.mockResolvedValue(null);

    const response = await request(app.getHttpServer() as Server)
      .post("/auth/protected-write")
      .set("Cookie", "better-auth.session_token=expired-session")
      .send({ value: "should not be saved" })
      .expect(401);

    expect(response.body).toMatchObject({
      code: "SESSION_EXPIRED",
      statusCode: 401,
    });
    expect(service.enforceSession).toHaveBeenCalledWith("expired-session", false);
  });
  it('returns SESSION_EXPIRED over HTTP when the session is expired', async () => {
    service.enforceSession.mockResolvedValue(null);

    const response = await request(app.getHttpServer() as Server)
      .get('/auth/session')
      .set('Cookie', 'better-auth.session_token=expired-session')
      .expect(401);

    expect(response.body).toMatchObject({
      code: 'SESSION_EXPIRED',
      statusCode: 401,
    });
  });
});
