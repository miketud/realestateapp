/*
  Warnings:

  - You are about to drop the `LoanDetails` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LoanDetails" DROP CONSTRAINT "LoanDetails_property_id_fkey";

-- DropForeignKey
ALTER TABLE "LoanDetails" DROP CONSTRAINT "LoanDetails_purchase_id_fkey";

-- DropTable
DROP TABLE "LoanDetails";

-- CreateTable
CREATE TABLE "loan_details" (
    "loan_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "loan_amount" DOUBLE PRECISION NOT NULL,
    "lender" TEXT NOT NULL,
    "interest_rate" DOUBLE PRECISION NOT NULL,
    "loan_term" INTEGER NOT NULL,
    "loan_mortgage" DOUBLE PRECISION NOT NULL,
    "loan_start" TIMESTAMP(3) NOT NULL,
    "loan_end" TIMESTAMP(3) NOT NULL,
    "loan_type" TEXT NOT NULL,
    "balloon_payment" BOOLEAN NOT NULL,
    "prepayment_penalty" BOOLEAN NOT NULL,
    "refinanced" BOOLEAN NOT NULL,
    "loan_status" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "loan_details_pkey" PRIMARY KEY ("loan_id")
);

-- AddForeignKey
ALTER TABLE "loan_details" ADD CONSTRAINT "loan_details_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_details" ADD CONSTRAINT "loan_details_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchase_details"("purchase_id") ON DELETE RESTRICT ON UPDATE CASCADE;
