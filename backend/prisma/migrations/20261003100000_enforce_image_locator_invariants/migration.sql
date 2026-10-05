-- Prisma 7 does not model PostgreSQL CHECK constraints in the schema.
-- Keep managed image locators absent or complete even for non-application writes.
ALTER TABLE "asset"
ADD CONSTRAINT "asset_image_locator_complete_check"
CHECK (
    (
        "image_storage_provider" IS NULL
        AND "image_storage_account_id" IS NULL
        AND "image_public_id" IS NULL
        AND "image_resource_type" IS NULL
        AND "image_delivery_type" IS NULL
        AND "image_version" IS NULL
    )
    OR
    (
        "image_storage_provider" IS NOT NULL
        AND btrim("image_storage_provider") <> ''
        AND "image_storage_account_id" IS NOT NULL
        AND btrim("image_storage_account_id") <> ''
        AND "image_public_id" IS NOT NULL
        AND btrim("image_public_id") <> ''
        AND "image_resource_type" IS NOT NULL
        AND "image_resource_type" = 'image'
        AND "image_delivery_type" IS NOT NULL
        AND "image_delivery_type" = 'upload'
        AND "image_version" IS NOT NULL
        AND "image_version" >= 1
    )
);

ALTER TABLE "users"
ADD CONSTRAINT "users_image_locator_complete_check"
CHECK (
    (
        "image_storage_provider" IS NULL
        AND "image_storage_account_id" IS NULL
        AND "image_public_id" IS NULL
        AND "image_resource_type" IS NULL
        AND "image_delivery_type" IS NULL
        AND "image_version" IS NULL
    )
    OR
    (
        "image_storage_provider" IS NOT NULL
        AND btrim("image_storage_provider") <> ''
        AND "image_storage_account_id" IS NOT NULL
        AND btrim("image_storage_account_id") <> ''
        AND "image_public_id" IS NOT NULL
        AND btrim("image_public_id") <> ''
        AND "image_resource_type" IS NOT NULL
        AND "image_resource_type" = 'image'
        AND "image_delivery_type" IS NOT NULL
        AND "image_delivery_type" = 'authenticated'
        AND "image_version" IS NOT NULL
        AND "image_version" >= 1
        AND "imageUrl" IS NULL
    )
);
