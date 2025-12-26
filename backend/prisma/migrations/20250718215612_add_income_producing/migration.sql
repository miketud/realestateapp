-- CreateEnum
CREATE TYPE "YesNo" AS ENUM ('YES', 'NO');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "income_producing" "YesNo" NOT NULL DEFAULT 'NO';
