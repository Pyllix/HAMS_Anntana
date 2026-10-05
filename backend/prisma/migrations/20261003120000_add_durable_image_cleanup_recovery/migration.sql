-- Keep the upload-intent deadline separate from the provider signature and
-- from the later attachment window. Existing intents inherit their signed
-- deadline; cleanup waits through the configured default settlement horizon.
ALTER TABLE "image_upload"
ADD COLUMN "intent_expires_at" TIMESTAMP(3),
ADD COLUMN "reconciliation_after" TIMESTAMP(3);

UPDATE "image_upload"
SET "intent_expires_at" = "signature_expires_at",
    "reconciliation_after" = "signature_expires_at" + INTERVAL '10 minutes';

ALTER TABLE "image_upload"
ALTER COLUMN "intent_expires_at" SET NOT NULL,
ALTER COLUMN "reconciliation_after" SET NOT NULL;

-- Replace any still-pending historical 24-hour window with the one-hour rule.
-- Already-claimed records do not use the pending attachment TTL.
UPDATE "image_upload"
SET "attachment_expires_at" = LEAST(
  "attachment_expires_at",
  "provider_created_at" + INTERVAL '1 hour'
)
WHERE "status" = 'VERIFIED_PENDING'
  AND "attachment_expires_at" IS NOT NULL
  AND "provider_created_at" IS NOT NULL;

CREATE INDEX "image_upload_status_intent_expires_at_idx"
ON "image_upload"("status", "intent_expires_at");

ALTER TABLE "image_cleanup"
ADD COLUMN "upload_id" UUID;

ALTER TABLE "image_cleanup"
ALTER COLUMN "version" DROP NOT NULL;

CREATE INDEX "image_cleanup_status_lease_expires_at_idx"
ON "image_cleanup"("status", "lease_expires_at");

CREATE INDEX "image_cleanup_upload_id_idx"
ON "image_cleanup"("upload_id");

ALTER TYPE "ImageCleanupStatus" ADD VALUE 'RETAINED';

-- Link already-enqueued superseded-object work back to its immutable upload
-- tombstone. The locator is trusted because it matches a managed upload row.
UPDATE "image_cleanup" AS cleanup
SET "upload_id" = upload."id"
   ,"eligible_at" = GREATEST(cleanup."eligible_at", upload."reconciliation_after")
FROM "image_upload" AS upload
WHERE cleanup."upload_id" IS NULL
  AND cleanup."storage_provider" = upload."storage_provider"
  AND cleanup."storage_account_id" = upload."cloud_name"
  AND cleanup."public_id" = upload."public_id"
  AND cleanup."resource_type" = upload."resource_type"
  AND cleanup."delivery_type" = upload."delivery_type";

-- Recover terminal work from earlier deployments where expiry/rejection was
-- recorded before a cleanup outbox row existed.
INSERT INTO "image_cleanup" (
  "id", "storage_provider", "storage_account_id", "public_id", "upload_id",
  "version", "resource_type", "delivery_type", "reason", "status",
  "eligible_at", "attempt_count", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), upload."storage_provider", upload."cloud_name",
  upload."public_id", upload."id", upload."verified_version",
  upload."resource_type", upload."delivery_type",
  CASE upload."status"
    WHEN 'SUPERSEDED' THEN 'SUPERSEDED_ATTACHMENT'::"ImageCleanupReason"
    WHEN 'REJECTED' THEN 'REJECTED_UPLOAD'::"ImageCleanupReason"
    ELSE 'EXPIRED_UPLOAD'::"ImageCleanupReason"
  END,
  'PENDING'::"ImageCleanupStatus",
  GREATEST(
    upload."signature_expires_at",
    COALESCE(upload."attachment_expires_at", upload."signature_expires_at")
  ) + INTERVAL '10 minutes',
  0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "image_upload" AS upload
WHERE upload."status" IN ('SUPERSEDED', 'REJECTED', 'EXPIRED')
  AND NOT EXISTS (
    SELECT 1 FROM "image_cleanup" AS existing
    WHERE existing."storage_provider" = upload."storage_provider"
      AND existing."storage_account_id" = upload."cloud_name"
      AND existing."public_id" = upload."public_id"
      AND existing."resource_type" = upload."resource_type"
      AND existing."delivery_type" = upload."delivery_type"
  );
