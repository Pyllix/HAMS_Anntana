-- DropForeignKey
ALTER TABLE "transfer" DROP CONSTRAINT IF EXISTS "transfer_approved_by_fkey";

-- DropForeignKey
ALTER TABLE "transfer" DROP CONSTRAINT IF EXISTS "transfer_received_by_fkey";

-- DropForeignKey
ALTER TABLE "transfer" DROP CONSTRAINT IF EXISTS "transfer_requested_by_fkey";

-- AlterTable
ALTER TABLE "transfer" DROP COLUMN IF EXISTS "approved_by",
DROP COLUMN IF EXISTS "received_by",
DROP COLUMN IF EXISTS "requested_by",
DROP COLUMN IF EXISTS "transfer_status",
ADD COLUMN IF NOT EXISTS "transferred_by" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "transfer" DROP CONSTRAINT IF EXISTS "transfer_transferred_by_fkey";
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_transferred_by_fkey" FOREIGN KEY ("transferred_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
