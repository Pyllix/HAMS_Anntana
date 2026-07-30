/*
  Warnings:

  - The primary key for the `asset_disposal` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `asset_lost` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "asset_disposal" DROP CONSTRAINT "asset_disposal_pkey",
ALTER COLUMN "disposal_id" DROP DEFAULT,
ALTER COLUMN "disposal_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "asset_disposal_pkey" PRIMARY KEY ("disposal_id");
DROP SEQUENCE "asset_disposal_disposal_id_seq";

-- AlterTable
ALTER TABLE "asset_lost" DROP CONSTRAINT "asset_lost_pkey",
ALTER COLUMN "lost_id" DROP DEFAULT,
ALTER COLUMN "lost_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "asset_lost_pkey" PRIMARY KEY ("lost_id");
DROP SEQUENCE "asset_lost_lost_id_seq";
