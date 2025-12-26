/*
  Warnings:

  - You are about to drop the `rent_roll` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "rent_roll" DROP CONSTRAINT "rent_roll_property_id_fkey";

-- DropTable
DROP TABLE "rent_roll";

-- CreateTable
CREATE TABLE "rent_log" (
    "rent_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "rent_amount" DECIMAL(12,2) NOT NULL,
    "date_deposited" TIMESTAMP(3) NOT NULL,
    "check_number" INTEGER,
    "notes" TEXT,

    CONSTRAINT "rent_log_pkey" PRIMARY KEY ("rent_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rent_log_property_id_month_year_key" ON "rent_log"("property_id", "month", "year");

-- AddForeignKey
ALTER TABLE "rent_log" ADD CONSTRAINT "rent_log_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;
