-- AlterTable
ALTER TABLE "loan_details" ALTER COLUMN "loan_amount" DROP NOT NULL,
ALTER COLUMN "lender" DROP NOT NULL,
ALTER COLUMN "interest_rate" DROP NOT NULL,
ALTER COLUMN "loan_term" DROP NOT NULL,
ALTER COLUMN "loan_type" DROP NOT NULL,
ALTER COLUMN "balloon_payment" DROP NOT NULL,
ALTER COLUMN "prepayment_penalty" DROP NOT NULL,
ALTER COLUMN "refinanced" DROP NOT NULL,
ALTER COLUMN "loan_status" DROP NOT NULL,
ALTER COLUMN "monthly_payment" DROP NOT NULL;
