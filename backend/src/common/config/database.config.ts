import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// กรองเฉพาะ DeprecationWarning และ Notice ของ pg ที่พ่นเรื่อง libpq/client.query pipelining ออก
// เพื่อให้ console สะอาด โดยยังคงความเร็วระดับสูงสุดไว้
const originalEmitWarning = process.emitWarning;
process.emitWarning = function (warning: string | Error, ...args: any[]) {
  const warningMsg = typeof warning === 'string' ? warning : warning?.message || '';
  if (
    warningMsg.includes('client.query() when the client is already executing') ||
    warningMsg.includes('pg-connection-string') ||
    warningMsg.includes('libpq semantics')
  ) {
    return; // ซ่อน warning สองตัวนี้
  }
  return (originalEmitWarning as any).call(process, warning, ...args);
};

/**
 * Enterprise PostgreSQL Connection Pool Configuration
 * รัน Pipelining เต็มสปีด รองรับทั้ง Localhost และ Render Cloud DB
 */
export const sharedPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.DATABASE_POOL_MAX
    ? parseInt(process.env.DATABASE_POOL_MAX, 10)
    : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// กำหนด maxListeners ให้สอดคล้องกับขนาด Pool เพื่อป้องกัน MemoryLeak Warning
sharedPool.setMaxListeners(50);
sharedPool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

export const sharedAdapter = new PrismaPg(sharedPool);
export const sharedPrisma = new PrismaClient({ adapter: sharedAdapter });
