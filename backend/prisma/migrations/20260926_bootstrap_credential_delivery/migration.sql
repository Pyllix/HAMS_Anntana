CREATE TABLE "bootstrap_credential_deliveries" (
    "user_id" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bootstrap_credential_deliveries_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "bootstrap_credential_deliveries"
ADD CONSTRAINT "bootstrap_credential_deliveries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
