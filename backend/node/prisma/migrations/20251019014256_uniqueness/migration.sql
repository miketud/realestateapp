/*
  Warnings:

  - A unique constraint covering the columns `[property_id,tenant_name,lease_start]` on the table `tenant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "tenant_property_id_tenant_name_lease_start_key" ON "public"."tenant"("property_id", "tenant_name", "lease_start");
