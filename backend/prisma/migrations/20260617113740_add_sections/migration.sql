/*
  Warnings:

  - Made the column `section_id` on table `users` required. This step will fail if there are existing NULL values in that column.

*/

-- Step 1: Create the sections table first
CREATE TABLE "sections" (
    "section_id" TEXT NOT NULL,
    "section_code" VARCHAR(20) NOT NULL DEFAULT '',
    "name" VARCHAR(255) NOT NULL DEFAULT '',
    "tel" VARCHAR(20) NOT NULL DEFAULT '',
    "building" VARCHAR(100) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sections_pkey" PRIMARY KEY ("section_id")
);

-- Step 2: Unique index on code
CREATE UNIQUE INDEX "sections_section_code_key" ON "sections"("section_code");

-- Step 3: Insert a default IT section so existing users have a valid FK target
INSERT INTO "sections" ("section_id", "section_code", "name", "tel", "building", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'IT', 'Information Technology', '1234', 'Admin Building', CURRENT_TIMESTAMP);

-- Step 4: Point all existing users to the default section
UPDATE "users" SET "section_id" = '00000000-0000-0000-0000-000000000001';

-- Step 5: Now make the column NOT NULL
ALTER TABLE "users" ALTER COLUMN "section_id" SET NOT NULL;

-- Step 6: Add the foreign key constraint
ALTER TABLE "users" ADD CONSTRAINT "users_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE RESTRICT ON UPDATE CASCADE;
