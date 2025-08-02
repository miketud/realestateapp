-- AlterTable
ALTER TABLE "rent_roll" ALTER COLUMN "date_deposited" SET DATA TYPE DATE;

-- CreateTable
CREATE TABLE "transactions" (
    "transaction_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "transaction_type" VARCHAR(100),
    "notes" VARCHAR(255),
    "transaction_amount" DECIMAL(10,2) NOT NULL,
    "transaction_date" DATE NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;
