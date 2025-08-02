/*
  Warnings:

  - A unique constraint covering the columns `[property_id]` on the table `purchase_details` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "purchase_details_property_id_key" ON "purchase_details"("property_id");
