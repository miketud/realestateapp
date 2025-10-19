-- DropIndex
DROP INDEX "public"."tenant_property_id_key";

-- CreateIndex
CREATE INDEX "tenant_property_id_idx" ON "public"."tenant"("property_id");
