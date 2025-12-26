-- CreateTable
CREATE TABLE "properties" (
    "property_id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zipcode" INTEGER,
    "county" TEXT,
    "owner" TEXT NOT NULL,
    "purchase_price" DOUBLE PRECISION,
    "year" INTEGER,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "property_name" VARCHAR(255) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("property_id")
);

-- CreateTable
CREATE TABLE "rent_roll" (
    "rent_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "rent_amount" DECIMAL(10,2) NOT NULL,
    "date_deposited" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "check_number" INTEGER,

    CONSTRAINT "rent_roll_pkey" PRIMARY KEY ("rent_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rent_roll_property_id_month_year_key" ON "rent_roll"("property_id", "month", "year");

-- AddForeignKey
ALTER TABLE "rent_roll" ADD CONSTRAINT "rent_roll_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;
