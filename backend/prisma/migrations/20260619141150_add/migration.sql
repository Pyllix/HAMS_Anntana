-- CreateTable
CREATE TABLE "asset_status" (
    "status_id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL DEFAULT '',
    "name" VARCHAR(255) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "asset_status_pkey" PRIMARY KEY ("status_id")
);

-- CreateTable
CREATE TABLE "availability_status" (
    "availability_status_id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL DEFAULT '',
    "name" VARCHAR(255) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "availability_status_pkey" PRIMARY KEY ("availability_status_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_status_code_key" ON "asset_status"("code");

-- CreateIndex
CREATE UNIQUE INDEX "availability_status_code_key" ON "availability_status"("code");
