/*
  Warnings:

  - You are about to drop the column `asset_model` on the `asset` table. All the data in the column will be lost.
  - You are about to drop the column `asset_name` on the `asset` table. All the data in the column will be lost.
  - You are about to drop the column `asset_type_id` on the `asset` table. All the data in the column will be lost.
  - You are about to drop the column `disposal_approved_at` on the `asset` table. All the data in the column will be lost.
  - You are about to drop the column `gmdn` on the `asset` table. All the data in the column will be lost.
  - You are about to drop the column `is_medical_device` on the `asset` table. All the data in the column will be lost.
  - You are about to drop the column `received_date` on the `asset` table. All the data in the column will be lost.
  - You are about to alter the column `serial_no` on the `asset` table. The data in that column could be lost. The data in that column will be cast from `VarChar(100)` to `VarChar(30)`.
  - The `risk_level` column on the `asset` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `asset_status` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `code` on the `asset_status` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `asset_status` table. All the data in the column will be lost.
  - You are about to drop the column `status_id` on the `asset_status` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `availability_status` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `availability_status` table. All the data in the column will be lost.
  - You are about to drop the `asset_disposal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `asset_lost` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[status_code]` on the table `asset_status` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[status_code]` on the table `availability_status` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[employee_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `model` to the `asset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `asset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `owner_id` to the `asset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receive_date` to the `asset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type_id` to the `asset` table without a default value. This is not possible if the table is not empty.
  - Made the column `image_url` on table `asset` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ReturnCondition" AS ENUM ('Normal', 'Damage');

-- CreateEnum
CREATE TYPE "ReturnMethod" AS ENUM ('self_return', 'staff_pickup');

-- CreateEnum
CREATE TYPE "RequestSource" AS ENUM ('SELF_SERVICE', 'CENTER_SERVICE');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "PmType" AS ENUM ('IM', 'EM');

-- CreateEnum
CREATE TYPE "CalType" AS ENUM ('IC', 'EC');

-- DropForeignKey
ALTER TABLE "asset" DROP CONSTRAINT "asset_asset_status_id_fkey";

-- DropForeignKey
ALTER TABLE "asset" DROP CONSTRAINT "asset_asset_type_id_fkey";

-- DropForeignKey
ALTER TABLE "asset" DROP CONSTRAINT "asset_availability_status_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_disposal" DROP CONSTRAINT "asset_disposal_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_disposal" DROP CONSTRAINT "asset_disposal_created_by_fkey";

-- DropForeignKey
ALTER TABLE "asset_disposal" DROP CONSTRAINT "asset_disposal_disposal_status_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_disposal" DROP CONSTRAINT "asset_disposal_updated_by_fkey";

-- DropForeignKey
ALTER TABLE "asset_lost" DROP CONSTRAINT "asset_lost_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_lost" DROP CONSTRAINT "asset_lost_created_by_fkey";

-- DropForeignKey
ALTER TABLE "asset_lost" DROP CONSTRAINT "asset_lost_updated_by_fkey";

-- DropIndex
DROP INDEX "asset_status_code_key";

-- DropIndex
DROP INDEX "availability_status_code_key";

-- AlterTable
ALTER TABLE "asset" DROP COLUMN "asset_model",
DROP COLUMN "asset_name",
DROP COLUMN "asset_type_id",
DROP COLUMN "disposal_approved_at",
DROP COLUMN "gmdn",
DROP COLUMN "is_medical_device",
DROP COLUMN "received_date",
ADD COLUMN     "acq_doc" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "acq_type" VARCHAR(100) NOT NULL DEFAULT '',
ADD COLUMN     "budget_type" VARCHAR(100) NOT NULL DEFAULT '',
ADD COLUMN     "cal_interval_month" INTEGER,
ADD COLUMN     "cal_type" "CalType" NOT NULL DEFAULT 'IC',
ADD COLUMN     "equipment_type" INTEGER,
ADD COLUMN     "is_backup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_special" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "model" VARCHAR(100) NOT NULL,
ADD COLUMN     "name" VARCHAR(100) NOT NULL,
ADD COLUMN     "noid" VARCHAR(30),
ADD COLUMN     "owner_id" TEXT NOT NULL,
ADD COLUMN     "pm_interval_month" INTEGER,
ADD COLUMN     "pm_type" "PmType" NOT NULL DEFAULT 'IM',
ADD COLUMN     "receive_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "type_id" INTEGER NOT NULL,
ALTER COLUMN "serial_no" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "price" SET DATA TYPE DECIMAL(15,2),
ALTER COLUMN "warranty_date" SET DATA TYPE VARCHAR(30),
DROP COLUMN "risk_level",
ADD COLUMN     "risk_level" "RiskLevel" NOT NULL DEFAULT 'UNSPECIFIED',
ALTER COLUMN "image_url" SET NOT NULL,
ALTER COLUMN "image_url" SET DEFAULT '',
ALTER COLUMN "availability_status_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "asset_status" DROP CONSTRAINT "asset_status_pkey",
DROP COLUMN "code",
DROP COLUMN "name",
DROP COLUMN "status_id",
ADD COLUMN     "asset_status_id" SERIAL NOT NULL,
ADD COLUMN     "status_code" VARCHAR(20) NOT NULL DEFAULT '',
ADD COLUMN     "status_name" VARCHAR(50) NOT NULL DEFAULT '',
ADD CONSTRAINT "asset_status_pkey" PRIMARY KEY ("asset_status_id");

-- AlterTable
ALTER TABLE "availability_status" DROP COLUMN "code",
DROP COLUMN "name",
ADD COLUMN     "status_code" VARCHAR(20) NOT NULL DEFAULT '',
ADD COLUMN     "status_name" VARCHAR(50) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "employee_id" VARCHAR(50);

-- DropTable
DROP TABLE "asset_disposal";

-- DropTable
DROP TABLE "asset_lost";

-- CreateTable
CREATE TABLE "acq_type" (
    "acq_type_id" SERIAL NOT NULL,
    "acq_type_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "acq_type_pkey" PRIMARY KEY ("acq_type_id")
);

-- CreateTable
CREATE TABLE "borrow_status" (
    "borrow_status_id" SERIAL NOT NULL,
    "status_code" VARCHAR(20) NOT NULL DEFAULT '',
    "status_name" VARCHAR(50) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "borrow_status_pkey" PRIMARY KEY ("borrow_status_id")
);

-- CreateTable
CREATE TABLE "borrow_transaction" (
    "borrow_transaction_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "borrower_id" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "approved_by_user_id" TEXT,
    "handover_by_user_id" TEXT,
    "returned_by_user_id" TEXT,
    "received_by_user_id" TEXT,
    "rejected_by_user_id" TEXT,
    "cancelled_by_user_id" TEXT,
    "borrow_status_id" INTEGER NOT NULL,
    "approved_at" TIMESTAMP(3),
    "handover_date" TIMESTAMP(3),
    "return_date" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "return_condition" "ReturnCondition",
    "return_method" "ReturnMethod",
    "return_remark" TEXT,
    "reject_remark" TEXT,
    "request_source" "RequestSource" NOT NULL DEFAULT 'SELF_SERVICE',
    "delivery_method" "DeliveryMethod" NOT NULL DEFAULT 'PICKUP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borrow_transaction_pkey" PRIMARY KEY ("borrow_transaction_id")
);

-- CreateTable
CREATE TABLE "budget_type" (
    "budget_type_id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "fiscal_year" INTEGER,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "budget_type_pkey" PRIMARY KEY ("budget_type_id")
);

-- CreateTable
CREATE TABLE "disposal" (
    "disposal_id" TEXT NOT NULL,
    "disposal_doc_no" VARCHAR(255) NOT NULL,
    "approved_date" TIMESTAMP(3) NOT NULL,
    "asset_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "disposal_pkey" PRIMARY KEY ("disposal_id")
);

-- CreateTable
CREATE TABLE "equipment_type" (
    "equipment_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_type_pkey" PRIMARY KEY ("equipment_id")
);

-- CreateTable
CREATE TABLE "transfer" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "transfer_doc_no" VARCHAR(255) NOT NULL,
    "transfer_date" TIMESTAMP(3) NOT NULL,
    "from_section_id" TEXT,
    "to_section_id" TEXT,
    "from_location" VARCHAR(255),
    "to_location" VARCHAR(255),
    "requested_by" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "received_by" TEXT NOT NULL,
    "transfer_status" VARCHAR(100) NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "borrow_status_status_code_key" ON "borrow_status"("status_code");

-- CreateIndex
CREATE UNIQUE INDEX "asset_status_status_code_key" ON "asset_status"("status_code");

-- CreateIndex
CREATE UNIQUE INDEX "availability_status_status_code_key" ON "availability_status"("status_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "asset_type"("asset_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_asset_status_id_fkey" FOREIGN KEY ("asset_status_id") REFERENCES "asset_status"("asset_status_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_availability_status_id_fkey" FOREIGN KEY ("availability_status_id") REFERENCES "availability_status"("availability_status_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_equipment_type_fkey" FOREIGN KEY ("equipment_type") REFERENCES "equipment_type"("equipment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transaction" ADD CONSTRAINT "borrow_transaction_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("asset_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transaction" ADD CONSTRAINT "borrow_transaction_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transaction" ADD CONSTRAINT "borrow_transaction_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transaction" ADD CONSTRAINT "borrow_transaction_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transaction" ADD CONSTRAINT "borrow_transaction_handover_by_user_id_fkey" FOREIGN KEY ("handover_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transaction" ADD CONSTRAINT "borrow_transaction_returned_by_user_id_fkey" FOREIGN KEY ("returned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transaction" ADD CONSTRAINT "borrow_transaction_received_by_user_id_fkey" FOREIGN KEY ("received_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transaction" ADD CONSTRAINT "borrow_transaction_rejected_by_user_id_fkey" FOREIGN KEY ("rejected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transaction" ADD CONSTRAINT "borrow_transaction_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_transaction" ADD CONSTRAINT "borrow_transaction_borrow_status_id_fkey" FOREIGN KEY ("borrow_status_id") REFERENCES "borrow_status"("borrow_status_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal" ADD CONSTRAINT "disposal_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("asset_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("asset_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_from_section_id_fkey" FOREIGN KEY ("from_section_id") REFERENCES "sections"("section_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_to_section_id_fkey" FOREIGN KEY ("to_section_id") REFERENCES "sections"("section_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
