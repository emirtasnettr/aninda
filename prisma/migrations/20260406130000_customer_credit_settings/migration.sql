-- Customer cari borç yetkisi (kurumsal, ADMIN yönetir)
ALTER TABLE "Customer" ADD COLUMN "creditEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN "creditLimit" DECIMAL(14,2);
