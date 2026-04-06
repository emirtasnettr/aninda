-- OrderOfferStatus enum + offers table
CREATE TYPE "OrderOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'SUPERSEDED', 'EXPIRED');

CREATE TABLE "OrderCourierOffer" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "status" "OrderOfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderCourierOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderCourierOffer_orderId_courierId_key" ON "OrderCourierOffer"("orderId", "courierId");
CREATE INDEX "OrderCourierOffer_orderId_idx" ON "OrderCourierOffer"("orderId");
CREATE INDEX "OrderCourierOffer_courierId_idx" ON "OrderCourierOffer"("courierId");

ALTER TABLE "OrderCourierOffer" ADD CONSTRAINT "OrderCourierOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderCourierOffer" ADD CONSTRAINT "OrderCourierOffer_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Replace OrderStatus enum (map legacy values)
CREATE TYPE "OrderStatus_new" AS ENUM (
  'PENDING',
  'SEARCHING_COURIER',
  'ACCEPTED',
  'PICKED_UP',
  'ON_DELIVERY',
  'DELIVERED',
  'CANCELLED'
);

ALTER TABLE "Order" ADD COLUMN "status_new" "OrderStatus_new";

UPDATE "Order" SET "status_new" = CASE "status"::text
  WHEN 'PENDING' THEN 'PENDING'::"OrderStatus_new"
  WHEN 'ASSIGNED' THEN 'ACCEPTED'::"OrderStatus_new"
  WHEN 'PICKED_UP' THEN 'PICKED_UP'::"OrderStatus_new"
  WHEN 'IN_TRANSIT' THEN 'ON_DELIVERY'::"OrderStatus_new"
  WHEN 'DELIVERED' THEN 'DELIVERED'::"OrderStatus_new"
  WHEN 'CANCELLED' THEN 'CANCELLED'::"OrderStatus_new"
  ELSE 'PENDING'::"OrderStatus_new"
END;

ALTER TABLE "Order" DROP COLUMN "status";
ALTER TABLE "Order" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "Order" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"OrderStatus_new";

DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"OrderStatus";
