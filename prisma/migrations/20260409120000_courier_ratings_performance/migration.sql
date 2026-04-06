-- AlterTable
ALTER TABLE "Courier" ADD COLUMN "averageRating" DECIMAL(4,2),
ADD COLUMN "totalRatings" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "dispatchScore" DECIMAL(5,2) NOT NULL DEFAULT 50;

-- CreateTable
CREATE TABLE "CourierRating" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierPerformance" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
    "successfulDeliveries" INTEGER NOT NULL DEFAULT 0,
    "cancelledDeliveries" INTEGER NOT NULL DEFAULT 0,
    "averageDeliveryTimeMinutes" DECIMAL(10,2),
    "lastActiveAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourierRating_orderId_key" ON "CourierRating"("orderId");
CREATE INDEX "CourierRating_courierId_idx" ON "CourierRating"("courierId");
CREATE INDEX "CourierRating_createdAt_idx" ON "CourierRating"("createdAt");
CREATE UNIQUE INDEX "CourierPerformance_courierId_key" ON "CourierPerformance"("courierId");

-- AddForeignKey
ALTER TABLE "CourierRating" ADD CONSTRAINT "CourierRating_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourierRating" ADD CONSTRAINT "CourierRating_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourierRating" ADD CONSTRAINT "CourierRating_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourierPerformance" ADD CONSTRAINT "CourierPerformance_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
