-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BORROW_APPROVAL_REQUIRED', 'BORROW_APPROVED', 'REPAIR_APPROVAL_REQUIRED', 'REPAIR_READY_FOR_COLLECTION', 'BORROW_EXTENSION_APPROVAL_REQUIRED', 'BORROW_EXTENSION_APPROVED', 'BORROW_EXTENSION_REJECTED', 'BORROW_DUE_SOON', 'BORROW_OVERDUE');

-- CreateEnum
CREATE TYPE "NotificationResourceType" AS ENUM ('BORROW_TRANSACTION', 'BORROW_EXTENSION', 'REPAIR_JOB');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "resource_type" "NotificationResourceType" NOT NULL,
    "resource_id" TEXT NOT NULL,
    "event_key" VARCHAR(255) NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_id_idx" ON "notifications"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_event_key_user_id_key" ON "notifications"("event_key", "user_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
