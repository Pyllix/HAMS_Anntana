-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('Repair', 'Maintenance');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('REPAIR', 'FABRICATE', 'MODIFY', 'PREVENTIVE');

-- CreateEnum
CREATE TYPE "UrgencyStatus" AS ENUM ('NORMAL', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "StepActionType" AS ENUM ('INTERNAL_STOCK', 'EXTERNAL_STOCK', 'OUTSOURCE', 'PURCHASE_REPLACEMENT', 'SELF_REPAIR');

-- CreateTable
CREATE TABLE "job_status" (
    "job_status_id" SERIAL NOT NULL,
    "status_code" VARCHAR(20) NOT NULL,
    "status_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "job_status_pkey" PRIMARY KEY ("job_status_id")
);

-- CreateTable
CREATE TABLE "job_type" (
    "job_type_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "job_type_pkey" PRIMARY KEY ("job_type_id")
);

-- CreateTable
CREATE TABLE "cause" (
    "cause_id" SERIAL NOT NULL,
    "cause_code" VARCHAR(10) NOT NULL,
    "cause_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "delete_at" TIMESTAMP(3),

    CONSTRAINT "cause_pkey" PRIMARY KEY ("cause_id")
);

-- CreateTable
CREATE TABLE "tech_category" (
    "tech_category_id" SERIAL NOT NULL,
    "category_code" VARCHAR(20) NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "delete_at" TIMESTAMP(3),

    CONSTRAINT "tech_category_pkey" PRIMARY KEY ("tech_category_id")
);

-- CreateTable
CREATE TABLE "step_master" (
    "step_master_id" SERIAL NOT NULL,
    "step_number" INTEGER NOT NULL,
    "action_type" "StepActionType" NOT NULL,
    "label" VARCHAR(100) NOT NULL,

    CONSTRAINT "step_master_pkey" PRIMARY KEY ("step_master_id")
);

-- CreateTable
CREATE TABLE "repair_job" (
    "job_id" TEXT NOT NULL,
    "job_no" VARCHAR(255) NOT NULL,
    "asset_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "job_type_id" INTEGER NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "job_status_id" INTEGER NOT NULL,
    "company_id" TEXT,
    "bill_no" TEXT,
    "diagnosis" TEXT,
    "symptom" TEXT,
    "solution" TEXT,
    "cause_id" INTEGER,
    "action_type" "ActionType",
    "urgency_status" "UrgencyStatus" NOT NULL,
    "due_date" TIMESTAMP(3),
    "return_date" TIMESTAMP(3),
    "is_repeat_repair" BOOLEAN,
    "tech_category_id" INTEGER,
    "receiver_id" TEXT,
    "warranty_date" VARCHAR(30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "repair_job_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "repair_job_step" (
    "step_id" SERIAL NOT NULL,
    "job_id" TEXT NOT NULL,
    "step_master_id" INTEGER NOT NULL,
    "complete_at" TIMESTAMP(3),
    "note" TEXT,
    "completed_by" TEXT,

    CONSTRAINT "repair_job_step_pkey" PRIMARY KEY ("step_id")
);

-- CreateTable
CREATE TABLE "mechanic_repair" (
    "mechanic_repair_id" SERIAL NOT NULL,
    "job_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "delete_at" TIMESTAMP(3),

    CONSTRAINT "mechanic_repair_pkey" PRIMARY KEY ("mechanic_repair_id")
);

-- CreateTable
CREATE TABLE "sparepart_groups" (
    "group_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sparepart_groups_pkey" PRIMARY KEY ("group_id")
);

-- CreateTable
CREATE TABLE "spareparts" (
    "sparepart_id" SERIAL NOT NULL,
    "sparepart_code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(50) NOT NULL DEFAULT 'ชิ้น',
    "price" DECIMAL(15,2) NOT NULL,
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "qty_in_stock" INTEGER NOT NULL DEFAULT 0,
    "group_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "spareparts_pkey" PRIMARY KEY ("sparepart_id")
);

-- CreateTable
CREATE TABLE "sparepart_adds" (
    "sparepart_add_id" SERIAL NOT NULL,
    "sparepart_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "total_price" DECIMAL(15,2) NOT NULL,
    "sparepart_add_doc" VARCHAR(100) NOT NULL,
    "add_by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sparepart_adds_pkey" PRIMARY KEY ("sparepart_add_id")
);

-- CreateTable
CREATE TABLE "sparepart_txns" (
    "txn_id" SERIAL NOT NULL,
    "sparepart_id" INTEGER NOT NULL,
    "job_id" TEXT,
    "txn_type" VARCHAR(100) NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "txn_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txn_by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sparepart_txns_pkey" PRIMARY KEY ("txn_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_status_status_code_key" ON "job_status"("status_code");

-- CreateIndex
CREATE UNIQUE INDEX "repair_job_job_no_key" ON "repair_job"("job_no");

-- CreateIndex
CREATE UNIQUE INDEX "spareparts_sparepart_code_key" ON "spareparts"("sparepart_code");

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("asset_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_job_type_id_fkey" FOREIGN KEY ("job_type_id") REFERENCES "job_type"("job_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_job_status_id_fkey" FOREIGN KEY ("job_status_id") REFERENCES "job_status"("job_status_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_cause_id_fkey" FOREIGN KEY ("cause_id") REFERENCES "cause"("cause_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_tech_category_id_fkey" FOREIGN KEY ("tech_category_id") REFERENCES "tech_category"("tech_category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job" ADD CONSTRAINT "repair_job_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job_step" ADD CONSTRAINT "repair_job_step_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "repair_job"("job_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job_step" ADD CONSTRAINT "repair_job_step_step_master_id_fkey" FOREIGN KEY ("step_master_id") REFERENCES "step_master"("step_master_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_job_step" ADD CONSTRAINT "repair_job_step_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_repair" ADD CONSTRAINT "mechanic_repair_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "repair_job"("job_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_repair" ADD CONSTRAINT "mechanic_repair_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spareparts" ADD CONSTRAINT "spareparts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "sparepart_groups"("group_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sparepart_adds" ADD CONSTRAINT "sparepart_adds_sparepart_id_fkey" FOREIGN KEY ("sparepart_id") REFERENCES "spareparts"("sparepart_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sparepart_adds" ADD CONSTRAINT "sparepart_adds_add_by_fkey" FOREIGN KEY ("add_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sparepart_txns" ADD CONSTRAINT "sparepart_txns_sparepart_id_fkey" FOREIGN KEY ("sparepart_id") REFERENCES "spareparts"("sparepart_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sparepart_txns" ADD CONSTRAINT "sparepart_txns_txn_by_fkey" FOREIGN KEY ("txn_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sparepart_txns" ADD CONSTRAINT "sparepart_txns_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "repair_job"("job_id") ON DELETE SET NULL ON UPDATE CASCADE;
