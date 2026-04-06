import { Prisma } from '@prisma/client';

export type DispatchScoreInput = {
  averageRating: Prisma.Decimal | null;
  totalRatings: number;
  successfulDeliveries: number;
  cancelledDeliveries: number;
  averageDeliveryTimeMinutes: Prisma.Decimal | null;
  lastActiveAt: Date | null;
};

/** 0–100: rating 40%, başarı 30%, süre 20%, aktiflik 10% */
export function computeDispatchScore(input: DispatchScoreInput): number {
  const totalClosed = input.successfulDeliveries + input.cancelledDeliveries;

  const ratingPoints =
    input.totalRatings > 0 && input.averageRating != null
      ? ((Number(input.averageRating) - 1) / 4) * 40
      : 20;

  const successRate =
    totalClosed > 0 ? input.successfulDeliveries / totalClosed : 0.5;
  const successPoints = successRate * 30;

  let speedPoints = 10;
  if (input.averageDeliveryTimeMinutes != null) {
    const m = Number(input.averageDeliveryTimeMinutes);
    speedPoints = Math.max(
      0,
      Math.min(20, 20 * (1 - Math.max(0, m - 25) / 65)),
    );
  }

  let activityPoints = 0;
  if (input.lastActiveAt) {
    const hours = (Date.now() - input.lastActiveAt.getTime()) / 3_600_000;
    if (hours <= 24) activityPoints = 10;
    else if (hours <= 168) activityPoints = 5;
  }

  const raw = ratingPoints + successPoints + speedPoints + activityPoints;
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
}
