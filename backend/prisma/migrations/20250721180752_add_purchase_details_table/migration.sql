-- CreateTable
CREATE TABLE "purchase_details" (
    "purchase_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "purchase_price" DECIMAL(12,2) NOT NULL,
    "financing_type" TEXT NOT NULL,
    "acquisition_type" TEXT NOT NULL,
    "buyer" TEXT NOT NULL,
    "seller" TEXT NOT NULL,
    "closing_date" TIMESTAMP(3) NOT NULL,
    "closing_costs" DECIMAL(12,2) NOT NULL,
    "earnest_money" DECIMAL(12,2),
    "notes" TEXT,

    CONSTRAINT "purchase_details_pkey" PRIMARY KEY ("purchase_id")
);

-- AddForeignKey
ALTER TABLE "purchase_details" ADD CONSTRAINT "purchase_details_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;
