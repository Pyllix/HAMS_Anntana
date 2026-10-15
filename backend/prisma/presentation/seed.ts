import { Prisma, type PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { seedReferenceData } from '../seed-reference';
import { originalProfile, originalUserPreparation } from './user-profiles';
import { presentationSectionData } from './sections';
import { writePresentationRecords } from './records';
import { inventoryLabels, partLabels, supplementalUsers } from './labels';
import {
  PRESENTATION_MARKER,
  PRESENTATION_VERSION,
  presentationId,
  validateFixture,
  type PresentationFixture,
} from './fixtures';

export interface ManifestRow {
  kind:
    | 'user'
    | 'asset'
    | 'borrow'
    | 'extension'
    | 'repair'
    | 'part'
    | 'transfer'
    | 'disposal'
    | 'notification';
  key: string;
  id: string | number;
  document?: string;
  role?: string;
  state?: string;
}
export interface PresentationManifest {
  varietyProfile?: 'varied-v1';
  expansionDate?: string;
  version: number;
  userProfile?: 'original-seed-v1';
  labelProfile?: 'hospital-v1';
  date: string;
  rows: ManifestRow[];
  preparation: string[];
}

export function nextDocument(prefix: string, existing: string[]): string {
  const sequences = existing
    .filter((value) => value.startsWith(prefix))
    .map((value) => {
      const suffix = value.slice(prefix.length);
      if (!/^\d{4}$/.test(suffix))
        throw new Error(
          `Unsupported document format for ${prefix}; inspect the existing series first`,
        );
      return Number(suffix);
    });
  const sequence = Math.max(0, ...sequences) + 1;
  if (sequence > 9999) throw new Error(`Document series exhausted: ${prefix}`);
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

export async function readPresentationManifest(
  prisma: Pick<PrismaClient, 'company'>,
): Promise<PresentationManifest | null> {
  const marker = await prisma.company.findUnique({
    where: { code: PRESENTATION_MARKER },
  });
  if (!marker) return null;
  if (marker.id !== presentationId('marker'))
    throw new Error(
      'Presentation marker belongs to another record; no data was changed',
    );
  let manifest: PresentationManifest;
  try {
    manifest = JSON.parse(marker.remark) as PresentationManifest;
  } catch {
    throw new Error('Presentation marker is not readable; no data was changed');
  }
  if (
    manifest.version !== PRESENTATION_VERSION ||
    !Array.isArray(manifest.rows) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(manifest.date)
  )
    throw new Error('Unsupported presentation manifest; no data was changed');
  return manifest;
}

/** Create-only, atomic fixture set. A rerun never rewinds workflows or inventory. */
export async function seedPresentation(
  prisma: PrismaClient,
  fixture: PresentationFixture,
  password: string,
): Promise<{ manifest: PresentationManifest; created: boolean }> {
  validateFixture(fixture);
  if (password.length < 12)
    throw new Error(
      'DEMO_PRESENTATION_PASSWORD must contain at least 12 characters',
    );
  const passwordHash = await hashPassword(password);
  const originalHashes = new Map<string, string>();
  for (const user of fixture.users) {
    const profile = originalProfile(user.key);
    if (profile && !originalHashes.has(profile.password))
      originalHashes.set(
        profile.password,
        await hashPassword(profile.password),
      );
  }
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(90261009)`;
      const existing = await readPresentationManifest(tx);
      if (existing) return { manifest: existing, created: false };

      // Refuse to take over orphaned/colliding records rather than overwriting them.
      const userIds = fixture.users.map((user) =>
        presentationId(`user:${user.key}`),
      );
      const assetIds = fixture.assets.map((asset) =>
        presentationId(`asset:${asset.key}`),
      );
      const conflicts = await Promise.all([
        tx.user.count({
          where: {
            OR: [
              { id: { in: userIds } },
              {
                email: {
                  in: fixture.users.map(
                    (user) =>
                      originalProfile(user.key)?.email ??
                      supplementalUsers[user.key]?.email ??
                      `present-${user.key}@demo.hams.local`,
                  ),
                },
              },
            ],
          },
        }),
        tx.asset.count({
          where: {
            OR: [
              { id: { in: assetIds } },
              { serialNo: { startsWith: 'PRESENT-SN-' } },
            ],
          },
        }),
        tx.section.count({
          where: {
            code: {
              in: fixture.sections.map(
                (section) => presentationSectionData(section).code,
              ),
            },
          },
        }),
        tx.company.count({
          where: {
            code: {
              in: [
                inventoryLabels.vendor.code,
                inventoryLabels.restoreVendor.code,
              ],
            },
          },
        }),
        tx.sparepart.count({
          where: {
            code: { in: Object.values(partLabels).map((part) => part.code) },
          },
        }),
      ]);
      if (conflicts.some((count) => count > 0))
        throw new Error(
          'Presentation records exist without a completed manifest. Inspect them before seeding; no records were overwritten',
        );

      await seedReferenceData(tx);
      const sections = new Map<string, string>();
      for (const key of fixture.sections) {
        const section = await tx.section.create({
          data: {
            ...presentationSectionData(key),
          },
        });
        sections.set(key, section.id);
      }
      await tx.section.create({
        data: {
          id: presentationId('section:restore'),
          ...inventoryLabels.restoreSection,
          deletedAt: fixture.date,
        },
      });
      await tx.company.create({
        data: {
          id: presentationId('vendor'),
          ...inventoryLabels.vendor,
        },
      });
      await tx.company.create({
        data: {
          id: presentationId('vendor:restore'),
          ...inventoryLabels.restoreVendor,
          deletedAt: fixture.date,
        },
      });
      await tx.acqType.create({
        data: {
          name: inventoryLabels.restoreAcquisition,
          description: 'รับโอนครุภัณฑ์จากหน่วยงานภาครัฐตามหนังสือส่งมอบ',
          isActive: false,
          deletedAt: fixture.date,
        },
      });
      await tx.budgetType.create({
        data: {
          name: inventoryLabels.budget,
          fiscalYear: fixture.date.getUTCFullYear() + 543,
          description: 'งบพัฒนาศักยภาพเครื่องมือสำหรับให้บริการผู้ป่วย',
          isActive: true,
        },
      });
      await tx.budgetType.create({
        data: {
          name: inventoryLabels.inactiveBudget,
          fiscalYear: fixture.date.getUTCFullYear() + 542,
          description: 'งบดำเนินการปรับปรุงอุปกรณ์ในปีงบประมาณที่ผ่านมา',
          isActive: false,
        },
      });

      const manifest: PresentationManifest = {
        version: PRESENTATION_VERSION,
        varietyProfile: 'varied-v1',
        userProfile: 'original-seed-v1',
        labelProfile: 'hospital-v1',
        date: fixture.date.toISOString().slice(0, 10),
        rows: [],
        preparation: originalUserPreparation,
      };
      const employeePrefix = `GOV-${String((fixture.date.getUTCFullYear() + 543) % 100).padStart(2, '0')}`;
      const existingEmployeeIds = (
        await tx.user.findMany({
          where: { employeeId: { startsWith: employeePrefix } },
          select: { employeeId: true },
        })
      ).map((row) => row.employeeId!);
      for (const user of fixture.users) {
        const profile = originalProfile(user.key);
        const displayProfile = profile ?? supplementalUsers[user.key];
        const employeeId =
          profile?.employeeId ??
          nextDocument(employeePrefix, existingEmployeeIds);
        const email =
          displayProfile?.email ?? `present-${user.key}@demo.hams.local`;
        existingEmployeeIds.push(employeeId);
        const result = await tx.user.create({
          data: {
            id: presentationId(`user:${user.key}`),
            employeeId,
            userName: displayProfile?.userName ?? `present-${user.key}`,
            firstname: displayProfile?.firstname ?? 'ผู้ใช้ทดลอง',
            lastname: displayProfile?.lastname ?? user.key,
            email,
            emailVerified: user.verified,
            role: user.role,
            section_id: sections.get(user.section)!,
            createdAt: fixture.date,
            updatedAt: fixture.date,
            deletedAt: user.deleted ? fixture.date : null,
            accounts: {
              create: {
                id: presentationId(`credential:${user.key}`),
                accountId: email,
                providerId: 'credential',
                password: profile
                  ? originalHashes.get(profile.password)!
                  : passwordHash,
                createdAt: fixture.date,
                updatedAt: fixture.date,
              },
            },
          },
        });
        manifest.rows.push({
          kind: 'user',
          key: user.key,
          id: result.id,
          document: employeeId,
          role: user.role,
          state: user.deleted
            ? 'DELETED'
            : user.verified
              ? 'VERIFIED · 2FA preparation may be required'
              : 'EMAIL_UNVERIFIED',
        });
      }
      await writePresentationRecords(tx, fixture, manifest);
      await tx.company.create({
        data: {
          id: presentationId('marker'),
          code: PRESENTATION_MARKER,
          name: 'ระบบทะเบียนครุภัณฑ์ส่วนกลาง',
          remark: JSON.stringify(manifest),
          group: 'SYSTEM',
        },
      });
      return { manifest, created: true };
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
