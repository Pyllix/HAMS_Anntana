import 'dotenv/config';
import { Pool, PoolConfig } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Enterprise PostgreSQL Connection Pool Configuration
 * ป้องกัน Connection Exhaustion และรองรับ Cloud Database (เช่น Render, Neon, Supabase)
 */
const connectionString = process.env.DATABASE_URL;
const isRemoteDb =
  connectionString?.includes('render.com') ||
  connectionString?.includes('sslmode=') ||
  connectionString?.includes('singapore-postgres');

const poolConfig: PoolConfig = {
  connectionString,
  max: process.env.DATABASE_POOL_MAX
    ? parseInt(process.env.DATABASE_POOL_MAX, 10)
    : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ...(isRemoteDb && {
    ssl: {
      rejectUnauthorized: false,
    },
  }),
};

export const sharedPool = new Pool(poolConfig);

// node-postgres Pool เป็น EventEmitter ซึ่งมีค่าเริ่มต้น maxListeners = 10
// PrismaPg adapter จะผูก error listener กับ pool ในทุก query/connection
// จึงต้องปรับ maxListeners ให้สอดคล้องกับ max connections เพื่อไม่ให้เกิด warning
sharedPool.setMaxListeners(50);
sharedPool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

export const sharedAdapter = new PrismaPg(sharedPool);
export const sharedPrisma = new PrismaClient({ adapter: sharedAdapter });
