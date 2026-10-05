-- CreateEnum
CREATE TYPE "ImageCleanupStatus" AS ENUM ('PENDING', 'LEASED', 'RETRY', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ImageCleanupReason" AS ENUM ('SUPERSEDED_ATTACHMENT', 'EXPIRED_UPLOAD', 'REJECTED_UPLOAD', 'UNREPORTED_UPLOAD', 'LATE_UPLOAD');

-- AlterEnum
ALTER TYPE "ImageUploadStatus" ADD VALUE 'SUPERSEDED';

-- AlterTable
ALTER TABLE "asset" ADD COLUMN     "image_delivery_type" VARCHAR(20),
ADD COLUMN     "image_public_id" VARCHAR(255),
ADD COLUMN     "image_resource_type" VARCHAR(20),
ADD COLUMN     "image_storage_account_id" VARCHAR(128),
ADD COLUMN     "image_storage_provider" VARCHAR(40),
ADD COLUMN     "image_version" INTEGER;

-- AlterTable
ALTER TABLE "image_upload" ADD COLUMN     "claim_fingerprint" CHAR(64);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "image_delivery_type" VARCHAR(20),
ADD COLUMN     "image_public_id" VARCHAR(255),
ADD COLUMN     "image_resource_type" VARCHAR(20),
ADD COLUMN     "image_storage_account_id" VARCHAR(128),
ADD COLUMN     "image_storage_provider" VARCHAR(40),
ADD COLUMN     "image_version" INTEGER;

-- CreateTable
CREATE TABLE "image_cleanup" (
    "id" UUID NOT NULL,
    "storage_provider" VARCHAR(40) NOT NULL,
    "storage_account_id" VARCHAR(128) NOT NULL,
    "public_id" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL,
    "resource_type" VARCHAR(20) NOT NULL,
    "delivery_type" VARCHAR(20) NOT NULL,
    "reason" "ImageCleanupReason" NOT NULL,
    "status" "ImageCleanupStatus" NOT NULL DEFAULT 'PENDING',
    "eligible_at" TIMESTAMP(3) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "lease_token" VARCHAR(80),
    "lease_expires_at" TIMESTAMP(3),
    "last_error_code" VARCHAR(80),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_cleanup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "image_cleanup_status_eligible_at_next_attempt_at_idx" ON "image_cleanup"("status", "eligible_at", "next_attempt_at");

-- CreateIndex
CREATE INDEX "image_cleanup_storage_provider_storage_account_id_public_id_idx" ON "image_cleanup"("storage_provider", "storage_account_id", "public_id");

-- CreateIndex
CREATE UNIQUE INDEX "image_cleanup_storage_provider_storage_account_id_public_id_key" ON "image_cleanup"("storage_provider", "storage_account_id", "public_id", "resource_type", "delivery_type");
