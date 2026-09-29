CREATE UNIQUE INDEX "acq_type_non_deleted_name_unique"
ON "acq_type" (LOWER(BTRIM("acq_type_name")))
WHERE "deleted_at" IS NULL;
