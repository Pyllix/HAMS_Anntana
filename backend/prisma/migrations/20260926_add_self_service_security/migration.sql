ALTER TABLE "two_factor_auth"
ADD COLUMN "pending_secret_encrypted" TEXT;

CREATE TABLE "admin_step_ups" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_step_ups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_step_ups_session_id_key"
ON "admin_step_ups"("session_id");

CREATE INDEX "admin_step_ups_expires_at_idx"
ON "admin_step_ups"("expires_at");

ALTER TABLE "admin_step_ups"
ADD CONSTRAINT "admin_step_ups_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
