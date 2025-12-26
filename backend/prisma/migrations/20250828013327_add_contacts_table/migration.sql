/*
  Warnings:

  - You are about to drop the `loan_payments` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."loan_payments" DROP CONSTRAINT "loan_payments_loan_id_property_id_fkey";

-- DropTable
DROP TABLE "public"."loan_payments";

-- CreateTable
CREATE TABLE "public"."Contact" (
    "contact_id" SERIAL NOT NULL,
    "contact_name" VARCHAR(255) NOT NULL,
    "contact_phone" VARCHAR(20) NOT NULL,
    "contact_email" VARCHAR(255),
    "contact_type" VARCHAR(100),
    "contact_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("contact_id")
);
