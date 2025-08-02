/*
  Warnings:

  - You are about to drop the column `loan_mortgage` on the `loan_details` table. All the data in the column will be lost.
  - You are about to drop the column `scheduled_payment_amount` on the `loan_payments` table. All the data in the column will be lost.
  - You are about to drop the column `scheduled_payment_date` on the `loan_payments` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[payment_code]` on the table `loan_payments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `monthly_payment` to the `loan_details` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "loan_details" DROP COLUMN "loan_mortgage",
ADD COLUMN     "monthly_payment" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "loan_payments" DROP COLUMN "scheduled_payment_amount",
DROP COLUMN "scheduled_payment_date",
ADD COLUMN     "payment_code" TEXT,
ADD COLUMN     "payment_due_date" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "loan_payments_payment_code_key" ON "loan_payments"("payment_code");
