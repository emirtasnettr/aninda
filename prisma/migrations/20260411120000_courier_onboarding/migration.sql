-- CreateEnum
CREATE TYPE "CourierApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Courier" ADD COLUMN "approvalStatus" "CourierApprovalStatus" NOT NULL DEFAULT 'PENDING';
UPDATE "Courier" SET "approvalStatus" = 'APPROVED';

ALTER TABLE "Courier" ADD COLUMN "phone" TEXT;
ALTER TABLE "Courier" ADD COLUMN "birthDate" DATE;
ALTER TABLE "Courier" ADD COLUMN "tcNo" TEXT;
ALTER TABLE "Courier" ADD COLUMN "plateNumber" TEXT;
ALTER TABLE "Courier" ADD COLUMN "hasCompany" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Courier" ADD COLUMN "companyTaxId" TEXT;
ALTER TABLE "Courier" ADD COLUMN "companyTaxOffice" TEXT;
ALTER TABLE "Courier" ADD COLUMN "companyAddress" TEXT;
ALTER TABLE "Courier" ADD COLUMN "residenceAddress" TEXT;
ALTER TABLE "Courier" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "Courier" ADD COLUMN "rejectionReason" TEXT;

CREATE UNIQUE INDEX "Courier_tcNo_key" ON "Courier"("tcNo");
