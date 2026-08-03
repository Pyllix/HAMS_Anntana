-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_section_id_fkey";

-- AlterTable
ALTER TABLE "sections" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "section_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "company" (
    "company_id" TEXT NOT NULL,
    "company_code" VARCHAR(20) NOT NULL DEFAULT '',
    "name" VARCHAR(255) NOT NULL DEFAULT '',
    "tel" VARCHAR(20) NOT NULL DEFAULT '',
    "email" VARCHAR(255) NOT NULL DEFAULT '',
    "address" VARCHAR(255) NOT NULL DEFAULT '',
    "fax" VARCHAR(20) NOT NULL DEFAULT '',
    "group" VARCHAR(20) NOT NULL DEFAULT '',
    "remark" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "company_pkey" PRIMARY KEY ("company_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_company_code_key" ON "company"("company_code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE SET NULL ON UPDATE CASCADE;
