import 'dotenv/config';
import { sharedPool, sharedPrisma } from '../src/common/config/database.config';
import { UserRole } from '@prisma/client';
import { loadBootstrapAdminEmails } from './bootstrap-admin-config';

interface ConfiguredAdmin {
  email: string;
  label: string;
}

interface ReadinessResult {
  admin: ConfiguredAdmin;
  accountExists: boolean;
  isAdmin: boolean;
  isActive: boolean;
  emailVerified: boolean;
  twoFactorEnrolled: boolean;
}

export function isAdminReady(
  result: Pick<
    ReadinessResult,
    | 'accountExists'
    | 'isAdmin'
    | 'isActive'
    | 'emailVerified'
    | 'twoFactorEnrolled'
  >,
): boolean {
  return (
    result.accountExists &&
    result.isAdmin &&
    result.isActive &&
    result.emailVerified &&
    result.twoFactorEnrolled
  );
}

function loadAdmins(): [ConfiguredAdmin, ConfiguredAdmin] {
  const [first, second] = loadBootstrapAdminEmails();
  return [
    { email: first, label: 'ADMIN 1' },
    { email: second, label: 'ADMIN 2' },
  ];
}

async function checkAdmin(admin: ConfiguredAdmin): Promise<ReadinessResult> {
  const user = await sharedPrisma.user.findUnique({
    where: { email: admin.email },
    select: {
      id: true,
      role: true,
      emailVerified: true,
      banned: true,
      deletedAt: true,
    },
  });

  if (!user) {
    return {
      admin,
      accountExists: false,
      isAdmin: false,
      isActive: false,
      emailVerified: false,
      twoFactorEnrolled: false,
    };
  }

  const twoFactor = await sharedPrisma.twoFactorAuth.findUnique({
    where: { userId: user.id },
    select: { enrollmentComplete: true },
  });

  return {
    admin,
    accountExists: true,
    isAdmin: user.role === UserRole.ADMIN,
    isActive: user.banned !== true && user.deletedAt === null,
    emailVerified: user.emailVerified,
    twoFactorEnrolled: twoFactor?.enrollmentComplete === true,
  };
}

function printResult(result: ReadinessResult): boolean {
  const checks = [
    `account=${result.accountExists ? 'ready' : 'missing'}`,
    `role=${result.isAdmin ? 'ADMIN' : 'not-ADMIN'}`,
    `active=${result.isActive ? 'yes' : 'no'}`,
    `email-verified=${result.emailVerified ? 'yes' : 'no'}`,
    `2FA-enrolled=${result.twoFactorEnrolled ? 'yes' : 'no'}`,
  ];
  const ready = isAdminReady(result);

  console.info(
    `${result.admin.label} (${result.admin.email}): ${checks.join(', ')}`,
  );
  return ready;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!/^[a-f0-9]{64}$/i.test(process.env.TWO_FACTOR_ENCRYPTION_KEY ?? '')) {
    throw new Error(
      'TWO_FACTOR_ENCRYPTION_KEY must be 64 hexadecimal characters',
    );
  }

  const admins = loadAdmins();
  const results = await Promise.all(admins.map(checkAdmin));
  const allReady = results.map(printResult).every(Boolean);

  if (!allReady) {
    console.error(
      'Handover blocked: both configured ADMIN accounts must be ready.',
    );
    process.exitCode = 1;
    return;
  }

  console.info(
    'Handover check passed: both configured ADMIN accounts are ready.',
  );
}

if (require.main === module) {
  main()
    .catch(() => {
      console.error(
        'Handover check failed. Check configuration and database availability.',
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await sharedPrisma.$disconnect();
      await sharedPool.end();
    });
}
