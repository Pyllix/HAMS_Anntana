import type { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { originalSections, originalUsers } from '../demo-identities';
import { presentationId, type DemoUser } from './fixtures';
import {
  nextDocument,
  readPresentationManifest,
  type PresentationManifest,
} from './seed';

import {
  originalPresentationUsers,
  originalProfile,
  originalUserPreparation,
} from './user-profiles';
import { presentationSectionData } from './sections';
import { supplementalUsers } from './labels';

export async function createPresentationUser(
  tx: Prisma.TransactionClient,
  user: DemoUser,
  sectionId: string,
  employeeId: string,
  passwordHash: string,
  date: Date,
) {
  const profile = originalProfile(user.key) ?? supplementalUsers[user.key];
  const email = profile?.email ?? `present-${user.key}@demo.hams.local`;
  return tx.user.create({
    data: {
      id: presentationId(`user:${user.key}`),
      employeeId: originalProfile(user.key)?.employeeId ?? employeeId,
      userName: profile?.userName ?? `present-${user.key}`,
      firstname: profile?.firstname ?? 'ผู้ใช้ทดลอง',
      lastname: profile?.lastname ?? user.key,
      email,
      emailVerified: user.verified,
      role: user.role,
      section_id: sectionId,
      createdAt: date,
      updatedAt: date,
      deletedAt: user.deleted ? date : null,
      accounts: {
        create: {
          id: presentationId(`credential:${user.key}`),
          accountId: email,
          providerId: 'credential',
          password: passwordHash,
          createdAt: date,
          updatedAt: date,
        },
      },
    },
  });
}

/** Explicit one-time migration: preserve user IDs and business/security records. */
export async function restoreOriginalPresentationUsers(
  prisma: PrismaClient,
  fixtureUsers: DemoUser[],
  date: Date,
  fallbackPassword: string,
): Promise<PresentationManifest> {
  if (fallbackPassword.length < 12)
    throw new Error(
      'DEMO_PRESENTATION_PASSWORD must contain at least 12 characters',
    );
  const hashes = new Map<string, string>();
  for (const profile of originalUsers)
    if (!hashes.has(profile.password))
      hashes.set(profile.password, await hashPassword(profile.password));
  const fallbackHash = await hashPassword(fallbackPassword);
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(90261009)`;
      const manifest = await readPresentationManifest(tx);
      if (!manifest)
        throw new Error(
          'Seed the presentation data before restoring original users',
        );
      if (manifest.userProfile === 'original-seed-v1') return manifest;
      // Check every identity before updating; never take over another account.
      for (const { key, profile } of originalPresentationUsers) {
        const id = presentationId(`user:${key}`);
        const conflict = await tx.user.findFirst({
          where: {
            id: { not: id },
            OR: [{ email: profile.email }, { employeeId: profile.employeeId }],
          },
        });
        if (conflict)
          throw new Error(
            `Original identity already belongs to another user: ${profile.userName}`,
          );
      }
      const userRows: PresentationManifest['rows'] = [];
      const employeePrefix = `GOV-${String((date.getUTCFullYear() + 543) % 100).padStart(2, '0')}`;
      const usedIds = (
        await tx.user.findMany({ select: { employeeId: true } })
      ).flatMap((row) => (row.employeeId ? [row.employeeId] : []));
      for (const user of fixtureUsers) {
        const profile = originalProfile(user.key);
        const id = presentationId(`user:${user.key}`);
        const existing = await tx.user.findUnique({ where: { id } });
        const sectionId = presentationId(`section:${user.section}`);
        let section = await tx.section.findUnique({ where: { id: sectionId } });
        if (!section) {
          const sectionProfile = originalSections.find(
            (item) => item.code === user.section,
          );
          section = await tx.section.create({
            data: {
              id: sectionId,
              code: presentationSectionData(user.section).code,
              name: sectionProfile?.name ?? `DEMO · ${user.section}`,
              tel: sectionProfile?.tel ?? '0000',
              building: sectionProfile?.building,
            },
          });
        }
        const employeeId =
          profile?.employeeId ??
          existing?.employeeId ??
          nextDocument(employeePrefix, usedIds);
        usedIds.push(employeeId);
        const passwordHash = profile
          ? hashes.get(profile.password)!
          : fallbackHash;
        if (existing && profile) {
          await tx.user.update({
            where: { id },
            data: {
              employeeId,
              userName: profile.userName,
              firstname: profile.firstname,
              lastname: profile.lastname,
              email: profile.email,
              role: profile.role,
              section_id: section.id,
              updatedAt: new Date(),
            },
          });
          const accounts = await tx.account.findMany({
            where: { userId: id, providerId: 'credential' },
          });
          if (!accounts.length)
            throw new Error(
              `Credential account is missing: ${profile.userName}`,
            );
          await tx.account.updateMany({
            where: { userId: id, providerId: 'credential' },
            data: {
              accountId: profile.email,
              password: passwordHash,
              updatedAt: new Date(),
            },
          });
        } else if (!existing) {
          await createPresentationUser(
            tx,
            user,
            section.id,
            employeeId,
            passwordHash,
            date,
          );
        }
        userRows.push({
          kind: 'user',
          key: user.key,
          id,
          document: employeeId,
          role: user.role,
          state: user.deleted
            ? 'DELETED'
            : user.verified
              ? 'VERIFIED · 2FA preparation may be required'
              : 'EMAIL_UNVERIFIED',
        });
      }
      manifest.rows = [
        ...userRows,
        ...manifest.rows.filter((row) => row.kind !== 'user'),
      ];
      manifest.userProfile = 'original-seed-v1';
      manifest.preparation = originalUserPreparation;
      await tx.company.update({
        where: { id: presentationId('marker') },
        data: { remark: JSON.stringify(manifest) },
      });
      return manifest;
    },
    { isolationLevel: 'Serializable', maxWait: 10000, timeout: 120000 },
  );
}
