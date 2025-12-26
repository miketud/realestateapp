-- CreateTable
CREATE TABLE "public"."payment_log" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "payment_amount" DOUBLE PRECISION,
    "check_number" INTEGER,
    "notes" TEXT,
    "date_paid" TIMESTAMP(3),

    CONSTRAINT "payment_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_log_property_id_month_year_key" ON "public"."payment_log"("property_id", "month", "year");

-- AddForeignKey
ALTER TABLE "public"."payment_log" ADD CONSTRAINT "payment_log_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;
