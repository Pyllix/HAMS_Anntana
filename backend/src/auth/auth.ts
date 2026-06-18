import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { openAPI, bearer } from 'better-auth/plugins';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
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
      imageUrl: { type: 'string', required: false },
    },
  },
  plugins: [
    openAPI(),
    bearer(), // Enable Bearer token auth for API clients
  ],
});
