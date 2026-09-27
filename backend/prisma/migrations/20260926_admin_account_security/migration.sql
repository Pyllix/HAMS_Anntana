CREATE TABLE "security_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "reason" VARCHAR(1000),
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_audit_logs_actor_user_id_created_at_idx"
ON "security_audit_logs"("actor_user_id", "created_at");

CREATE INDEX "security_audit_logs_target_user_id_created_at_idx"
ON "security_audit_logs"("target_user_id", "created_at");
