-- AlterTable
ALTER TABLE "Courier" ADD COLUMN "documentsComplete" BOOLEAN NOT NULL DEFAULT false;

-- Daha önce onaylanmış kuryeler: mevcut davranışı koru (iş alabilsinler)
UPDATE "Courier" SET "documentsComplete" = true WHERE "approvalStatus" = 'APPROVED';
