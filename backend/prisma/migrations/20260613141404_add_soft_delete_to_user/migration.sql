/*
  Warnings:

  - Added the required column `role` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'PARCEL_STAFF', 'ASSET_CENTER_STAFF', 'DEPARTMENT_STAFF', 'MAINTENANCE_STAFF');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "section_id" TEXT,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL;
