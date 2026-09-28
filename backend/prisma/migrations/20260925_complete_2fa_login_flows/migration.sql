ALTER TABLE "two_factor_auth"
ADD COLUMN "enrollment_complete" BOOLEAN NOT NULL DEFAULT false;

-- Existing rows were created by the former implementation only after a valid
-- TOTP and recovery codes had already been issued.
UPDATE "two_factor_auth" SET "enrollment_complete" = true;
ALTER TABLE "two_factor_auth"
ALTER COLUMN "enrollment_complete" SET DEFAULT false;

CREATE TABLE "pre_auth_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "session_token_encrypted" TEXT NOT NULL,
    "session_cookies_encrypted" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pre_auth_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pre_auth_challenges_token_hash_key"
ON "pre_auth_challenges"("token_hash");
CREATE INDEX "pre_auth_challenges_expires_at_idx"
ON "pre_auth_challenges"("expires_at");
CREATE INDEX "pre_auth_challenges_user_id_idx"
ON "pre_auth_challenges"("user_id");