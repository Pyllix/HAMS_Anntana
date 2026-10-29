CREATE TABLE "email_verification_resend_limits" (
    "key" VARCHAR(100) NOT NULL,
    "request_times" TIMESTAMPTZ(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMPTZ(3)[],
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "email_verification_resend_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "email_verification_resend_limits_expires_at_idx"
    ON "email_verification_resend_limits"("expires_at");
