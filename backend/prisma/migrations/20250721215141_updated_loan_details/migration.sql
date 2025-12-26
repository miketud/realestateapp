/*
  Warnings:

  - A unique constraint covering the columns `[property_id,purchase_id]` on the table `loan_details` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "loan_details" ALTER COLUMN "loan_start" DROP NOT NULL,
ALTER COLUMN "loan_end" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "loan_details_property_id_purchase_id_key" ON "loan_details"("property_id", "purchase_id");
