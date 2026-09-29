CREATE UNIQUE INDEX "budget_type_non_deleted_name_unique"
ON "budget_type" (LOWER(BTRIM("name")))
WHERE "deleted_at" IS NULL;
