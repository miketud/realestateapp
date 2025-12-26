/*
  Warnings:

  - A unique constraint covering the columns `[address,city,state,zipcode]` on the table `properties` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."properties" ADD COLUMN     "geocoded_at" TIMESTAMP(3),
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "properties_city_state_idx" ON "public"."properties"("city", "state");

-- CreateIndex
CREATE INDEX "idx_property_lat_lng" ON "public"."properties"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_prop_address" ON "public"."properties"("address", "city", "state", "zipcode");
