-- AlterTable
ALTER TABLE "loan_details" ALTER COLUMN "loan_id" DROP DEFAULT;
DROP SEQUENCE "loan_details_loan_id_seq";

-- AlterTable
ALTER TABLE "rent_roll" ALTER COLUMN "rent_amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "transaction_amount" SET DATA TYPE DECIMAL(12,2);
