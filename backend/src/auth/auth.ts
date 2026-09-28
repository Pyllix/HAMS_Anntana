import 'dotenv/config';
import { betterAuth, getCurrentAdapter } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { openAPI, admin } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { sharedPrisma } from '../common/config/database.config';
import { mailService } from '../common/mail/mail.service';
import { isValidCsrfRequest, trustedOrigins } from './csrf-protection';

// ─── Access Control ───────────────────────────────────────────────────────────
// Define admin-level permissions matching better-auth's defaults,
// keyed by our Prisma UserRole enum values (uppercase).
const ac = createAccessControl({
  user: [
    'create',
    'list',
    'set-role',
    'ban',
    'impersonate',
    'delete',
    'set-password',
    'set-email',
    'get',
    'update',
  ] as const,
  session: ['list', 'revoke', 'delete'] as const,
});

const adminRole = ac.newRole({
  user: [
    'create',
    'list',
    'set-role',
    'ban',
    'impersonate',
    'delete',
    'set-password',
    'set-email',
    'get',
    'update',
  ],
  session: ['list', 'revoke', 'delete'],
});

const noPermRole = ac.newRole({
  user: [],
  session: [],
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const auth = betterAuth({
  database: prismaAdapter(sharedPrisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    expiresIn: 3600, // 1 hour
    sendVerificationEmail: async ({ user, url }) => {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const targetUrl = new URL(url);
      if (
        !targetUrl.searchParams.has('callbackURL') ||
        targetUrl.searchParams.get('callbackURL') === '/'
      ) {
        targetUrl.searchParams.set(
          'callbackURL',
          `${frontendUrl}/login?verified=true`,
        );
      }
      await mailService.sendVerificationEmail({
        to: user.email,
        name: user.name,
        verificationUrl: targetUrl.toString(),
      });
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (
        process.env.AUTH_DB_DIAGNOSTICS !== '1' ||
        ctx.path !== '/sign-in/email'
      ) {
        return;
      }

      const body = ctx.body as { email?: unknown } | undefined;
      const email = typeof body?.email === 'string' ? body.email : '';
      const currentAdapter = await getCurrentAdapter(ctx.context.adapter);
      let userFound = 'false';
      try {
        userFound = String(
          Boolean(
            await ctx.context.internalAdapter.findUserByEmail(email, {
              includeAccounts: true,
            }),
          ),
        );
      } catch (error) {
        userFound = `error:${error instanceof Error ? error.name : 'unknown'}`;
      }
      console.warn(
        `[AuthSignInContext] emailIsDemoAdmin=${email === 'admin@hospital.go.th'} ` +
          `adapterIsConfigured=${currentAdapter === ctx.context.adapter} ` +
          `internalUserExists=${userFound}`,
      );

      const internalAdapter = ctx.context.internalAdapter;
      ctx.context.internalAdapter = {
        ...internalAdapter,
        async findUserByEmail(lookedUpEmail, options) {
          const activeAdapter = await getCurrentAdapter(ctx.context.adapter);
          const logLookup = (outcome: string) =>
            console.warn(
              `[AuthSignInLookup] emailIsDemoAdmin=${lookedUpEmail === 'admin@hospital.go.th'} ` +
                `adapterIsConfigured=${activeAdapter === ctx.context.adapter} ` +
                `outcome=${outcome}`,
            );
          try {
            const result = await internalAdapter.findUserByEmail(
              lookedUpEmail,
              options,
            );
            logLookup(result ? 'found' : 'missing');
            return result;
          } catch (error) {
            logLookup(
              `error:${error instanceof Error ? error.name : 'unknown'}`,
            );
            throw error;
          }
        },
      };
    }),
  },
  trustedOrigins: trustedOrigins(),
  session: {
    expiresIn: 60 * 60 * 12,
    disableSessionRefresh: true,
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    cookiePrefix: 'better-auth',
    crossSubDomainCookies: {
      enabled: false, // host-only cookies
    },
  },
  // Map better-auth's built-in user fields to our schema column names
  user: {
    // Redirect better-auth's 'name' field to our 'firstname' column
    fields: {
      name: 'firstname',
      image: 'imageUrl',
    },
    additionalFields: {
      userName: { type: 'string', required: false, defaultValue: '' },
      lastname: { type: 'string', required: false, defaultValue: '' },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'DEPARTMENT_STAFF',
        input: false,
      },
      section_id: { type: 'string', required: false },
    },
  },
  plugins: [
    // HTTP-only boundary: HAMS services still use internal auth.api methods.
    {
      id: 'hams-account-route-boundary',
      // BetterAuth requires a Promise-returning onRequest hook.
      // eslint-disable-next-line @typescript-eslint/require-await
      async onRequest(request) {
        const path = new URL(request.url).pathname;
        const block = (code: string) => ({
          response: Response.json(
            {
              code,
              message: 'This auth route is unavailable',
              statusCode: 403,
            },
            { status: 403 },
          ),
        });

        if (request.method === 'POST' && path.endsWith('/sign-up/email')) {
          return block('PUBLIC_SIGNUP_DISABLED');
        }
        if (request.method === 'POST' && path.endsWith('/update-user')) {
          return block('DIRECT_ACCOUNT_UPDATE_DISABLED');
        }
        if (
          request.method === 'POST' &&
          (path.endsWith('/sign-in/email') || path.endsWith('/sign-in/social'))
        ) {
          return block('HAMS_SIGNIN_REQUIRED');
        }
        if (request.method === 'GET' && path.endsWith('/get-session')) {
          return block('DIRECT_SESSION_ROUTE_DISABLED');
        }
        if (path.includes('/admin/')) {
          return block('DIRECT_ADMIN_ROUTE_DISABLED');
        }
      },
    },
    // CSRF protection plugin
    {
      id: 'hams-csrf-protection',
      // BetterAuth requires a Promise-returning onRequest hook.
      // eslint-disable-next-line @typescript-eslint/require-await
      async onRequest(request) {
        const valid = isValidCsrfRequest({
          method: request.method,
          origin: request.headers.get('Origin'),
          csrfHeader: request.headers.get('X-CSRF-Token'),
          cookieHeader: request.headers.get('Cookie'),
        });

        if (!valid) {
          return {
            response: Response.json(
              {
                code: 'CSRF_INVALID',
                message: 'CSRF proof is missing or invalid',
                statusCode: 403,
              },
              { status: 403 },
            ),
          };
        }
      },
    },
    openAPI(),
    admin({
      defaultRole: 'DEPARTMENT_STAFF',
      adminRoles: ['ADMIN'],
      roles: {
        ADMIN: adminRole, // Prisma UserRole.ADMIN (uppercase)
        DEPARTMENT_STAFF: noPermRole,
        MANAGER: noPermRole,
        PARCEL_STAFF: noPermRole,
        ASSET_CENTER_STAFF: noPermRole,
        MAINTENANCE_STAFF: noPermRole,
      },
    }),
  ],
});
