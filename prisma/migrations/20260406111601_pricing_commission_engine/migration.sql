-- AlterTable
ALTER TABLE "Order" ADD COLUMN "courierEarningAmount" DECIMAL(12,2),
ADD COLUMN "courierSharePercent" DECIMAL(6,5),
ADD COLUMN "platformCommissionAmount" DECIMAL(12,2),
ADD COLUMN "pricingRuleId" TEXT;

-- AlterTable
ALTER TABLE "PricingRule" ADD COLUMN "courierSharePercent" DECIMAL(6,5),
ADD COLUMN "minPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "nightMultiplier" DECIMAL(8,4) NOT NULL DEFAULT 1,
ADD COLUMN "priorityMultiplier" DECIMAL(8,4) NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Order_pricingRuleId_idx" ON "Order"("pricingRuleId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "PricingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
