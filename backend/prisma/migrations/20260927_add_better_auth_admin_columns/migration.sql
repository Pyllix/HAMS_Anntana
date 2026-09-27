-- BetterAuth admin fields are present in the Prisma schema but were omitted
-- from the earlier migrations. Add them before account security routes run.
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "banned" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "banReason" TEXT,
ADD COLUMN IF NOT EXISTS "banExpires" TIMESTAMP(3);

ALTER TABLE "sessions"
ADD COLUMN IF NOT EXISTS "impersonatedBy" TEXT;
