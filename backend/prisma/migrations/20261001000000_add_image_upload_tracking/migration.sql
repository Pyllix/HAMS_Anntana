-- CreateEnum
CREATE TYPE "ImageUploadPurpose" AS ENUM ('ASSET_IMAGE', 'EMPLOYEE_PHOTO');

-- CreateEnum
CREATE TYPE "ImageUploadStatus" AS ENUM ('AUTHORIZED', 'VERIFIED_PENDING', 'CLAIMED', 'EXPIRED', 'REJECTED');

-- CreateTable
CREATE TABLE "image_upload" (
    "id" UUID NOT NULL,
    "uploader_id" TEXT NOT NULL,
    "purpose" "ImageUploadPurpose" NOT NULL,
    "target_id" TEXT,
    "creation_context_hash" CHAR(64),
    "storage_provider" VARCHAR(40) NOT NULL DEFAULT 'cloudinary',
    "cloud_name" VARCHAR(128) NOT NULL,
    "public_id" VARCHAR(255) NOT NULL,
    "resource_type" VARCHAR(20) NOT NULL DEFAULT 'image',
    "delivery_type" VARCHAR(20) NOT NULL,
    "policy_revision" VARCHAR(80) NOT NULL,
    "source_content_type" VARCHAR(80) NOT NULL,
    "declared_size_bytes" INTEGER NOT NULL,
    "status" "ImageUploadStatus" NOT NULL DEFAULT 'AUTHORIZED',
    "issued_at" TIMESTAMP(3) NOT NULL,
    "signature_expires_at" TIMESTAMP(3) NOT NULL,
    "provider_created_at" TIMESTAMP(3),
    "attachment_expires_at" TIMESTAMP(3),
    "verified_version" INTEGER,
    "verified_format" VARCHAR(20),
    "verified_bytes" INTEGER,
    "verified_width" INTEGER,
    "verified_height" INTEGER,
    "verified_pages" INTEGER,
    "verified_evidence_hash" CHAR(64),
    "claimed_target_id" TEXT,
    "claimed_at" TIMESTAMP(3),
    "rejection_code" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "image_upload_public_id_key" ON "image_upload"("public_id");

-- CreateIndex
CREATE INDEX "image_upload_uploader_id_purpose_created_at_idx" ON "image_upload"("uploader_id", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "image_upload_storage_provider_cloud_name_created_at_idx" ON "image_upload"("storage_provider", "cloud_name", "created_at");

-- CreateIndex
CREATE INDEX "image_upload_status_signature_expires_at_idx" ON "image_upload"("status", "signature_expires_at");

-- CreateIndex
CREATE INDEX "image_upload_status_attachment_expires_at_idx" ON "image_upload"("status", "attachment_expires_at");
