-- AlterTable
ALTER TABLE "loan_details" ADD COLUMN     "amortization_period" INTEGER;

-- AlterTable
ALTER TABLE "purchase_details" ADD COLUMN     "down_payment" DECIMAL(12,2);
