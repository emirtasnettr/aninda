-- CreateEnum
CREATE TYPE "PayoutRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

-- AlterEnum
ALTER TYPE "CourierEarningStatus" ADD VALUE 'REQUESTED';

-- AlterTable
ALTER TABLE "Courier" ADD COLUMN "bankName" TEXT,
ADD COLUMN "accountHolderName" TEXT,
ADD COLUMN "iban" TEXT;

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutRequestStatus" NOT NULL DEFAULT 'PENDING',
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CourierEarning" ADD COLUMN "payoutRequestId" TEXT;

-- CreateIndex
CREATE INDEX "PayoutRequest_courierId_idx" ON "PayoutRequest"("courierId");
CREATE INDEX "PayoutRequest_status_idx" ON "PayoutRequest"("status");
CREATE INDEX "PayoutRequest_createdAt_idx" ON "PayoutRequest"("createdAt");
CREATE INDEX "CourierEarning_payoutRequestId_idx" ON "CourierEarning"("payoutRequestId");

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourierEarning" ADD CONSTRAINT "CourierEarning_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "PayoutRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
