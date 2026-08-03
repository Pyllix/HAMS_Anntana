-- CreateTable
CREATE TABLE "asset_lost" (
    "lost_id" SERIAL NOT NULL,
    "discovered_at" TIMESTAMP(3) NOT NULL,
    "last_seen_location" VARCHAR(255) NOT NULL,
    "reason" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_lost_pkey" PRIMARY KEY ("lost_id")
);

-- CreateTable
CREATE TABLE "asset_disposal" (
    "disposal_id" SERIAL NOT NULL,
    "pending_reason" TEXT NOT NULL,
    "pending_at" TIMESTAMP(3) NOT NULL,
    "disposed_at" TIMESTAMP(3),
    "disposal_reason" TEXT,
    "remark" TEXT,
    "asset_id" TEXT NOT NULL,
    "disposal_status_id" INTEGER NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_disposal_pkey" PRIMARY KEY ("disposal_id")
);

-- CreateTable
CREATE TABLE "asset" (
    "asset_id" TEXT NOT NULL,
    "asset_name" VARCHAR(100) NOT NULL,
    "asset_model" VARCHAR(100) NOT NULL,
    "serial_no" VARCHAR(100),
    "gmdn" VARCHAR(100),
    "price" DECIMAL(10,2) NOT NULL,
    "disposal_approved_at" TIMESTAMP(3),
    "warranty_date" TIMESTAMP(3),
    "risk_level" SMALLINT NOT NULL,
    "is_medical_device" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT,
    "image_url" TEXT,
    "received_date" TIMESTAMP(3) NOT NULL,
    "section_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "asset_type_id" INTEGER NOT NULL,
    "asset_status_id" INTEGER NOT NULL,
    "availability_status_id" INTEGER NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("asset_id")
);

-- AddForeignKey
ALTER TABLE "asset_lost" ADD CONSTRAINT "asset_lost_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("asset_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_lost" ADD CONSTRAINT "asset_lost_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_lost" ADD CONSTRAINT "asset_lost_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_disposal" ADD CONSTRAINT "asset_disposal_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("asset_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_disposal" ADD CONSTRAINT "asset_disposal_disposal_status_id_fkey" FOREIGN KEY ("disposal_status_id") REFERENCES "asset_status"("status_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_disposal" ADD CONSTRAINT "asset_disposal_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_disposal" ADD CONSTRAINT "asset_disposal_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "asset_type"("asset_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_asset_status_id_fkey" FOREIGN KEY ("asset_status_id") REFERENCES "asset_status"("status_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_availability_status_id_fkey" FOREIGN KEY ("availability_status_id") REFERENCES "availability_status"("availability_status_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
