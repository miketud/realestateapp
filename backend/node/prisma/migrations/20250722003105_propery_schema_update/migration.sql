/*
  Warnings:

  - You are about to drop the column `financing_type` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `purchase_price` on the `properties` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "properties" DROP COLUMN "financing_type",
DROP COLUMN "purchase_price",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
