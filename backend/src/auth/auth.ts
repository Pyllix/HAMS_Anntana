import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { openAPI, bearer, admin } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { sharedPrisma } from '../common/config/database.config';

// ─── Access Control ───────────────────────────────────────────────────────────
// Define admin-level permissions matching better-auth's defaults,
// keyed by our Prisma UserRole enum values (uppercase).
const ac = createAccessControl({
  user: [
    'create', 'list', 'set-role', 'ban', 'impersonate',
    'delete', 'set-password', 'set-email', 'get', 'update',
  ] as const,
  session: ['list', 'revoke', 'delete'] as const,
});

const adminRole = ac.newRole({
  user: [
    'create', 'list', 'set-role', 'ban', 'impersonate',
    'delete', 'set-password', 'set-email', 'get', 'update',
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
    requireEmailVerification: false,
  },
  // Map better-auth's built-in user fields to our schema column names
  user: {
    // Redirect better-auth's 'name' field to our 'firstname' column
    fields: {
      name: 'firstname',
    },
    additionalFields: {
      userName: { type: 'string', required: false, defaultValue: '' },
      lastname: { type: 'string', required: false, defaultValue: '' },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'DEPARTMENT_STAFF',
      },
      section_id: { type: 'string', required: false },
      imageUrl: { type: 'string', required: false },
    },
  },
  plugins: [
    openAPI(),
    bearer(), // Enable Bearer token auth for API clients
    admin({
      defaultRole: 'DEPARTMENT_STAFF',
      adminRoles: ['ADMIN'],
      roles: {
        ADMIN: adminRole,            // Prisma UserRole.ADMIN (uppercase)
        DEPARTMENT_STAFF: noPermRole,
        MANAGER: noPermRole,
        PARCEL_STAFF: noPermRole,
        ASSET_CENTER_STAFF: noPermRole,
        MAINTENANCE_STAFF: noPermRole,
      },
    }),
  ],
});
