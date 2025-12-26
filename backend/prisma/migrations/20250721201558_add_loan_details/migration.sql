-- CreateTable
CREATE TABLE "LoanDetails" (
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

    CONSTRAINT "LoanDetails_pkey" PRIMARY KEY ("loan_id")
);

-- AddForeignKey
ALTER TABLE "LoanDetails" ADD CONSTRAINT "LoanDetails_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanDetails" ADD CONSTRAINT "LoanDetails_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchase_details"("purchase_id") ON DELETE RESTRICT ON UPDATE CASCADE;
