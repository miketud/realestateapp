/*
  Warnings:

  - A unique constraint covering the columns `[loan_id,property_id]` on the table `loan_details` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "loan_payments" (
    "loan_payment_id" SERIAL NOT NULL,
    "loan_id" TEXT NOT NULL,
    "property_id" INTEGER NOT NULL,
    "scheduled_payment_date" TIMESTAMP(3) NOT NULL,
    "date_paid" TIMESTAMP(3),
    "scheduled_payment_amount" DECIMAL(12,2) NOT NULL,
    "payment_amount" DECIMAL(12,2) NOT NULL,
    "principal_paid" DECIMAL(12,2) NOT NULL,
    "interest_paid" DECIMAL(12,2) NOT NULL,
    "late_fee" DECIMAL(12,2),
    "principal_balance" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_payments_pkey" PRIMARY KEY ("loan_payment_id")
);

-- CreateIndex
CREATE INDEX "loan_payments_loan_id_property_id_idx" ON "loan_payments"("loan_id", "property_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_details_loan_id_property_id_key" ON "loan_details"("loan_id", "property_id");

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loan_id_property_id_fkey" FOREIGN KEY ("loan_id", "property_id") REFERENCES "loan_details"("loan_id", "property_id") ON DELETE RESTRICT ON UPDATE CASCADE;
