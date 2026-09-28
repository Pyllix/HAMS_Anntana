import 'dotenv/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { UserRole } from '@prisma/client';
import type { PoolClient } from 'pg';
import { auth } from '../src/auth/auth';
import { sharedPool, sharedPrisma } from '../src/common/config/database.config';
import { mailService } from '../src/common/mail/mail.service';
import { loadBootstrapAdminEmails } from './bootstrap-admin-config';

interface BootstrapAdmin {
  email: string;
  userName: string;
  firstname: string;
  lastname: string;
  employeeId: string;
}

const BOOTSTRAP_LOCK_ID = 90260927;

class BootstrapConfigurationError extends Error {}

function requiredValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new BootstrapConfigurationError(`Missing required setting: ${name}`);
  }
  return value;
}

function loadAdmins(): [BootstrapAdmin, BootstrapAdmin] {
  let emails: [string, string];
  try {
    emails = loadBootstrapAdminEmails();
  } catch (error) {
    throw new BootstrapConfigurationError(
      error instanceof Error ? error.message : 'Invalid bootstrap ADMIN emails',
    );
  }
  const admins = [1, 2].map((index) => {
    const prefix = `BOOTSTRAP_ADMIN_${index}`;
    return {
      email: emails[index - 1],
      userName: requiredValue(`${prefix}_USERNAME`),
      firstname: requiredValue(`${prefix}_FIRSTNAME`),
      lastname: requiredValue(`${prefix}_LASTNAME`),
      employeeId: requiredValue(`${prefix}_EMPLOYEE_ID`),
    };
  }) as [BootstrapAdmin, BootstrapAdmin];

  const normalizedValues = [
    admins.map(({ userName }) => userName.toLowerCase()),
    admins.map(({ employeeId }) => employeeId.toLowerCase()),
  ];
  if (normalizedValues.some(([first, second]) => first === second)) {
    throw new BootstrapConfigurationError(
      'The two bootstrap ADMIN identities must be distinct',
    );
  }

  for (const [index, admin] of admins.entries()) {
    if (
      admin.email.length > 100 ||
      admin.userName.length > 50 ||
      admin.firstname.length > 100 ||
      admin.lastname.length > 100 ||
      admin.employeeId.length > 50
    ) {
      throw new BootstrapConfigurationError(
        `Bootstrap ADMIN ${index + 1} has invalid identity fields`,
      );
    }
  }

  return admins;
}

function validateProductionConfiguration(): void {
  if (process.env.NODE_ENV !== 'production') {
    throw new BootstrapConfigurationError('ADMIN bootstrap requires NODE_ENV=production');
  }
  if (!process.env.DATABASE_URL) {
    throw new BootstrapConfigurationError('DATABASE_URL is required');
  }
  if ((process.env.BETTER_AUTH_SECRET ?? '').length < 32) {
    throw new BootstrapConfigurationError(
      'BETTER_AUTH_SECRET must contain at least 32 characters',
    );
  }
  if (!/^[a-f0-9]{64}$/i.test(process.env.TWO_FACTOR_ENCRYPTION_KEY ?? '')) {
    throw new BootstrapConfigurationError(
      'TWO_FACTOR_ENCRYPTION_KEY must be 64 hexadecimal characters',
    );
  }

  for (const key of ['BETTER_AUTH_URL', 'FRONTEND_URL']) {
    const value = requiredValue(key);
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BootstrapConfigurationError(`${key} must be a valid HTTPS URL`);
    }
    if (url.protocol !== 'https:') {
      throw new BootstrapConfigurationError(
        `${key} must use HTTPS for production bootstrap`,
      );
    }
  }

  requiredValue('SMTP_HOST');
  if (
    process.env.SMTP_SECURE !== 'true' &&
    process.env.SMTP_REQUIRE_TLS !== 'true'
  ) {
    throw new BootstrapConfigurationError(
      'Credential delivery requires SMTP_SECURE=true or SMTP_REQUIRE_TLS=true',
    );
  }
}

async function acquireBootstrapLock(): Promise<{
  client: PoolClient;
  release: () => Promise<void>;
}> {
  const client = await sharedPool.connect();
  let acquired = false;
  try {
    const result = await client.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock(${BOOTSTRAP_LOCK_ID}) AS acquired`,
    );
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) {
      throw new Error('Another ADMIN bootstrap is already running');
    }
  } catch (error) {
    client.release();
    throw error;
  }

  return {
    client,
    async release() {
      try {
        await client.query(`SELECT pg_advisory_unlock(${BOOTSTRAP_LOCK_ID})`);
      } finally {
        client.release();
      }
    },
  };
}

function encryptionKey(): Buffer {
  const value = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(
      'TWO_FACTOR_ENCRYPTION_KEY must be 64 hexadecimal characters',
    );
  }
  return Buffer.from(value, 'hex');
}

function encryptInitialPassword(userId: string, password: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(userId));
  const encrypted = Buffer.concat([
    cipher.update(password, 'utf8'),
    cipher.final(),
  ]);
  return [
    iv.toString('hex'),
    cipher.getAuthTag().toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

function decryptInitialPassword(userId: string, encrypted: string): string {
  const [iv, tag, ciphertext] = encrypted.split(':');
  if (!iv || !tag || !ciphertext) {
    throw new Error('Invalid pending ADMIN credential delivery');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(iv, 'hex'),
  );
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

async function deliverPendingCredentials(
  admin: BootstrapAdmin,
  userId: string,
): Promise<void> {
  const pending = await sharedPrisma.bootstrapCredentialDelivery.findUnique({
    where: { userId },
  });
  if (!pending) return;

  await mailService.sendBootstrapAdminCredentials({
    to: admin.email,
    name: `${admin.firstname} ${admin.lastname}`,
    userName: admin.userName,
    initialPassword: decryptInitialPassword(userId, pending.passwordEncrypted),
  });
  // If this delete fails, a rerun sends the same password rather than a new one.
  await sharedPrisma.bootstrapCredentialDelivery.delete({ where: { userId } });
}

export async function ensureAdmin(admin: BootstrapAdmin): Promise<void> {
  const existing = await sharedPrisma.user.findUnique({
    where: { email: admin.email },
    select: {
      id: true,
      role: true,
      employeeId: true,
      userName: true,
      emailVerified: true,
      banned: true,
      deletedAt: true,
    },
  });

  if (existing) {
    if (
      existing.role !== UserRole.ADMIN ||
      existing.employeeId !== admin.employeeId ||
      existing.userName !== admin.userName ||
      existing.banned === true ||
      existing.deletedAt !== null
    ) {
      throw new Error(
        'An existing account conflicts with a configured bootstrap ADMIN; review it manually',
      );
    }

    const credentialAccount = await sharedPrisma.account.findFirst({
      where: { userId: existing.id, providerId: 'credential' },
      select: { id: true },
    });
    if (!credentialAccount) {
      throw new Error(
        'An existing bootstrap ADMIN has no credential account; review it manually',
      );
    }

    await deliverPendingCredentials(admin, existing.id);

    if (!existing.emailVerified) {
      await auth.api.sendVerificationEmail({ body: { email: admin.email } });
      console.info(
        `Verification email re-sent to configured ADMIN: ${admin.email}`,
      );
      return;
    }

    console.info(
      `Configured ADMIN already exists; password and 2FA left unchanged: ${admin.email}`,
    );
    return;
  }

  const identityConflict = await sharedPrisma.user.findFirst({
    where: {
      OR: [{ userName: admin.userName }, { employeeId: admin.employeeId }],
    },
    select: { id: true },
  });
  if (identityConflict) {
    throw new Error(
      'A configured username or employee ID is already assigned to another account',
    );
  }

  const initialPassword = randomBytes(32).toString('base64url');
  const userId = randomUUID();
  const now = new Date();
  const passwordHash = await hashPassword(initialPassword);
  const passwordEncrypted = encryptInitialPassword(userId, initialPassword);

  await sharedPrisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        employeeId: admin.employeeId,
        userName: admin.userName,
        firstname: admin.firstname,
        lastname: admin.lastname,
        email: admin.email,
        emailVerified: false,
        role: UserRole.ADMIN,
        banned: false,
        createdAt: now,
        updatedAt: now,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: userId,
            providerId: 'credential',
            password: passwordHash,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    });
    await tx.securityAuditLog.create({
      data: {
        actorUserId: 'system:admin-bootstrap',
        targetUserId: userId,
        action: 'USER_CREATED',
        details: {
          source: 'production-bootstrap',
          role: UserRole.ADMIN,
        },
      },
    });
    await tx.bootstrapCredentialDelivery.create({
      data: { userId, passwordEncrypted },
    });
  });

  await deliverPendingCredentials(admin, userId);
  await auth.api.sendVerificationEmail({ body: { email: admin.email } });
  console.info(
    `New ADMIN account provisioned; verification email sent: ${admin.email}`,
  );
}

async function main(): Promise<void> {
  let lock: Awaited<ReturnType<typeof acquireBootstrapLock>> | undefined;
  try {
    validateProductionConfiguration();
    const admins = loadAdmins();
    lock = await acquireBootstrapLock();
    for (const admin of admins) await ensureAdmin(admin);
  } finally {
    if (lock) await lock.release();
    await sharedPrisma.$disconnect();
    await sharedPool.end();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof BootstrapConfigurationError
        ? `ADMIN bootstrap configuration error: ${error.message}`
        : 'ADMIN bootstrap stopped. No password values were written to application logs.',
    );
    process.exitCode = 1;
  });
}
