-- The legacy repair tracks were replaced by WITH_PARTS and UNREPAIRABLE in
-- the application. Do not discard existing repair steps that still use them.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "step_master"
    WHERE "action_type"::text IN (
      'INTERNAL_STOCK',
      'EXTERNAL_STOCK',
      'PURCHASE_REPLACEMENT'
    )
  ) THEN
    RAISE EXCEPTION 'Legacy StepActionType values are still in use; migrate those step_master rows before removing the enum values';
  END IF;
END $$;

ALTER TYPE "StepActionType" RENAME TO "StepActionType_legacy";
CREATE TYPE "StepActionType" AS ENUM (
  'SELF_REPAIR',
  'WITH_PARTS',
  'OUTSOURCE',
  'UNREPAIRABLE'
);

ALTER TABLE "step_master"
  ALTER COLUMN "action_type" TYPE "StepActionType"
  USING ("action_type"::text::"StepActionType");

DROP TYPE "StepActionType_legacy";
