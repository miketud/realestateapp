/*
  Warnings:

  - The primary key for the `loan_details` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "loan_details" DROP CONSTRAINT "loan_details_pkey",
ALTER COLUMN "loan_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "loan_details_pkey" PRIMARY KEY ("loan_id");
