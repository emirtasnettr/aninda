-- CreateEnum
CREATE TYPE "CourierWorkflowStatus" AS ENUM ('PENDING', 'PRE_APPROVED', 'DOCUMENT_PENDING', 'DOCUMENT_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CourierDocumentType" AS ENUM ('ID_FRONT', 'LICENSE_FRONT', 'LICENSE_BACK', 'RESIDENCE', 'CRIMINAL_RECORD');

-- CreateEnum
CREATE TYPE "CourierDocumentReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Courier" ADD COLUMN "workflowStatus" "CourierWorkflowStatus";

UPDATE "Courier" SET "workflowStatus" = CASE
  WHEN "approvalStatus"::text = 'REJECTED' THEN 'REJECTED'::"CourierWorkflowStatus"
  WHEN "approvalStatus"::text = 'APPROVED' AND "documentsComplete" = true THEN 'APPROVED'::"CourierWorkflowStatus"
  WHEN "approvalStatus"::text = 'APPROVED' AND "documentsComplete" = false THEN 'PRE_APPROVED'::"CourierWorkflowStatus"
  ELSE 'PENDING'::"CourierWorkflowStatus"
END;

ALTER TABLE "Courier" ALTER COLUMN "workflowStatus" SET NOT NULL;

ALTER TABLE "Courier" DROP COLUMN "documentsComplete";
ALTER TABLE "Courier" DROP COLUMN "approvalStatus";

DROP TYPE "CourierApprovalStatus";

-- CreateTable
CREATE TABLE "CourierDocument" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "type" "CourierDocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "reviewStatus" "CourierDocumentReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourierDocument_courierId_type_key" ON "CourierDocument"("courierId", "type");

-- AddForeignKey
ALTER TABLE "CourierDocument" ADD CONSTRAINT "CourierDocument_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
