import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  buildPresentationFixture,
  presentationDate,
  stockBalance,
  validateFixture,
} from './presentation/fixtures';
import {
  readPresentationManifest,
  seedPresentation,
} from './presentation/seed';
import { checkPresentation } from './presentation/check';
import { restoreOriginalPresentationUsers } from './presentation/users';
import { repairPresentationCenterSection } from './presentation/sections';
import { attachPresentationSampleImages } from './presentation/images';
import { relabelPresentation } from './presentation/relabel';

export function assertPresentationTarget(
  url: string | undefined,
  nodeEnv: string | undefined,
  allowDevelopment = false,
): string {
  if (nodeEnv === 'production')
    throw new Error('Presentation seeding is disabled in production');
  if (!url)
    throw new Error(
      'DEMO_DATABASE_URL is required; DATABASE_URL is deliberately not used',
    );
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DEMO_DATABASE_URL is not a valid PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
    throw new Error('DEMO_DATABASE_URL must use PostgreSQL');
  if (!allowDevelopment && !/demo|test|present/i.test(parsed.pathname))
    throw new Error(
      'Use a dedicated demo/test/presentation database, or explicitly pass --allow-existing-development for a development database',
    );
  return url;
}

const option = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--'))
    throw new Error(`Missing value for ${name}`);
  return value;
};
async function saveJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
async function main(): Promise<void> {
  const dateText = option('--date');
  const fixture = buildPresentationFixture(presentationDate(dateText));
  validateFixture(fixture);
  const output = resolve(
    option('--output') ?? '.temp/presentation-manifest.json',
  );
  if (process.argv.includes('--dry-run')) {
    const plan = {
      mode: 'dry-run',
      date: fixture.date.toISOString().slice(0, 10),
      counts: Object.fromEntries(
        [
          'users',
          'assets',
          'borrows',
          'extensions',
          'repairs',
          'parts',
          'txns',
          'transfers',
          'disposals',
        ].map((key) => [
          key,
          (fixture[key as keyof typeof fixture] as unknown[]).length,
        ]),
      ),
      inventory: fixture.parts.map((part) => ({
        key: part.key,
        opening: part.opening,
        remaining: stockBalance(fixture, part),
      })),
      scenarios: fixture,
    };
    await saveJson(output, plan);
    console.info(
      `Fixture validation passed (no database connection). Plan: ${output}`,
    );
    console.info(JSON.stringify(plan.counts));
    return;
  }
  if (!process.argv.includes('--demo'))
    throw new Error(
      'Pass --demo to explicitly select the presentation fixture',
    );
  const url = assertPresentationTarget(
    process.env.DEMO_DATABASE_URL,
    process.env.NODE_ENV,
    process.argv.includes('--allow-existing-development'),
  );
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    let existing = await readPresentationManifest(prisma);
    if (dateText && existing && existing.date !== dateText)
      throw new Error(
        'An existing presentation set has a different date. Rerun without --date to preserve it, or use a separate fresh demo database',
      );
    if (process.argv.includes('--natural-labels')) {
      if (!existing)
        throw new Error(
          'Seed the presentation data before changing its labels',
        );
      existing = await relabelPresentation(
        prisma,
        buildPresentationFixture(presentationDate(existing.date)),
      );
      console.info(
        'Hospital inventory labels configured; IDs and workflow states preserved.',
      );
    }
    if (process.argv.includes('--repair-center-section')) {
      const repair = await repairPresentationCenterSection(prisma);
      console.info(
        repair.updated
          ? 'Center section code repaired to CENTER; its ID and all business records preserved.'
          : 'Center section already uses CENTER; no section was changed.',
      );
    }
    if (process.argv.includes('--sample-asset-images')) {
      const updated = await attachPresentationSampleImages(
        prisma,
        fixture.assets,
      );
      console.info(
        `Public sample image URLs added to ${updated} blank presentation assets; existing images preserved. No uploads were requested.`,
      );
    }
    if (process.argv.includes('--check')) {
      if (!existing)
        throw new Error(
          'No presentation fixture was found; seed it before running --check',
        );
      const warnings = await checkPresentation(prisma, existing);
      await saveJson(output, existing);
      console.info('Business data consistency checks passed.');
      warnings.forEach((warning) => console.info(`Preparation: ${warning}`));
      return;
    }
    const restoreUsers = process.argv.includes('--restore-original-users');
    if (restoreUsers && !existing)
      throw new Error(
        'Seed the presentation data before restoring original users',
      );
    const restored = restoreUsers
      ? await restoreOriginalPresentationUsers(
          prisma,
          fixture.users,
          presentationDate(existing!.date),
          process.env.DEMO_PRESENTATION_PASSWORD ?? '',
        )
      : null;
    const result = restored
      ? { manifest: restored, created: false }
      : existing
        ? { manifest: existing, created: false }
        : await seedPresentation(
            prisma,
            fixture,
            process.env.DEMO_PRESENTATION_PASSWORD ?? '',
          );
    const warnings = await checkPresentation(prisma, result.manifest);
    await saveJson(output, result.manifest);
    console.info(
      restored
        ? 'Original seed accounts are configured; existing business data and user IDs preserved. Subsequent runs keep current passwords.'
        : result.created
          ? 'Presentation business fixtures created.'
          : 'Existing presentation fixtures preserved; no workflow, stock, password or document number was reset.',
    );
    console.info(`Manifest: ${output}`);
    warnings.forEach((warning) => console.info(`Preparation: ${warning}`));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
if (require.main === module)
  main().catch((error: unknown) => {
    // Prisma/driver errors may contain connection details. Show only their code.
    if (error && typeof error === 'object' && 'code' in error)
      console.error(
        `Presentation operation failed (code: ${String(error.code)}).`,
      );
    else
      console.error(
        error instanceof Error
          ? error.message
          : 'Presentation operation failed',
      );
    process.exitCode = 1;
  });
