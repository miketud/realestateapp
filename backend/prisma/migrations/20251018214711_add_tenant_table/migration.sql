-- CreateTable
CREATE TABLE "public"."tenant" (
    "tenant_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "tenant_name" VARCHAR(255),
    "tenant_status" VARCHAR(50),
    "lease_start" TIMESTAMP(3),
    "lease_end" TIMESTAMP(3),
    "rent_amount" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_property_id_key" ON "public"."tenant"("property_id");

-- CreateIndex
CREATE INDEX "tenant_tenant_status_idx" ON "public"."tenant"("tenant_status");

-- CreateIndex
CREATE INDEX "tenant_lease_start_lease_end_idx" ON "public"."tenant"("lease_start", "lease_end");

-- AddForeignKey
ALTER TABLE "public"."tenant" ADD CONSTRAINT "tenant_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;
