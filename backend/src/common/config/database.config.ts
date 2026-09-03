import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Enterprise PostgreSQL Connection Pool Configuration
 * ป้องกัน Connection Exhaustion และรองรับ Cloud Database (เช่น Render, Neon, Supabase)
 */
export const sharedPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.DATABASE_POOL_MAX ? parseInt(process.env.DATABASE_POOL_MAX, 10) : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const sharedAdapter = new PrismaPg(sharedPool);
export const sharedPrisma = new PrismaClient({ adapter: sharedAdapter });
