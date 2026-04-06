import { Injectable } from '@nestjs/common';
import {
  CourierWorkflowStatus,
  OrderOfferStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { loadBusyCourierIdsAmong } from './courier-active-order.util';
import { haversineDistanceKm } from './utils/haversine';

export const MATCHING_TOP_COURIERS = 5;
const FALLBACK_ONLINE_COURIERS = 25;
/** Mesafe bileşeni (normalize yakınlık) */
const MATCHING_DISTANCE_WEIGHT = 0.45;
/** dispatchScore (0–100) bileşeni */
const MATCHING_PERFORMANCE_WEIGHT = 0.55;

@Injectable()
export class OrderMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Çevrimiçi ve konum bilgisi olan kuryeleri pickup noktasına göre sıralayıp
   * en yakın N kurye için teklif (offer) kaydı oluşturur.
   */
  async offerTopCouriersByPickup(
    tx: Prisma.TransactionClient,
    orderId: string,
    pickupLat: number,
    pickupLng: number,
  ): Promise<string[]> {
    const online = await tx.courier.findMany({
      where: {
        isOnline: true,
        workflowStatus: CourierWorkflowStatus.APPROVED,
        lat: { not: null },
        lng: { not: null },
      },
      select: {
        id: true,
        lat: true,
        lng: true,
        dispatchScore: true,
      },
    });

    const busyIds = await loadBusyCourierIdsAmong(
      tx,
      online.map((c) => c.id),
    );
    const available = online.filter((c) => !busyIds.has(c.id));

    const withKm = available.map((c) => ({
      courierId: c.id,
      km: haversineDistanceKm(pickupLat, pickupLng, c.lat!, c.lng!),
      dispatchScore: Number(c.dispatchScore ?? 50),
    }));

    const invVals = withKm.map((r) => 1 / (1 + r.km));
    const maxInv = Math.max(...invVals, 1e-9);

    const ranked = withKm
      .map((r, i) => {
        const distNorm = invVals[i] / maxInv;
        const perfNorm = Math.min(1, Math.max(0, r.dispatchScore / 100));
        const combined =
          MATCHING_DISTANCE_WEIGHT * distNorm +
          MATCHING_PERFORMANCE_WEIGHT * perfNorm;
        return { courierId: r.courierId, km: r.km, combined };
      })
      .sort((a, b) => b.combined - a.combined)
      .slice(0, MATCHING_TOP_COURIERS);

    if (ranked.length === 0) {
      return [];
    }

    await tx.orderCourierOffer.createMany({
      data: ranked.map((r) => ({
        orderId,
        courierId: r.courierId,
        status: OrderOfferStatus.PENDING,
      })),
      skipDuplicates: true,
    });

    return ranked.map((r) => r.courierId);
  }

  /**
   * Yakında konumlu çevrimiçi kurye yoksa: tüm çevrimiçi kuryelere teklif açar
   * (konum girmemiş olanlar dahil) — bildirim gidebilsin diye.
   */
  async fallbackOffersWhenNoNearbyMatches(orderId: string): Promise<string[]> {
    return this.prisma.$transaction(async (tx) => {
      const online = await tx.courier.findMany({
        where: {
          isOnline: true,
          workflowStatus: CourierWorkflowStatus.APPROVED,
        },
        take: FALLBACK_ONLINE_COURIERS,
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      const busyIds = await loadBusyCourierIdsAmong(
        tx,
        online.map((c) => c.id),
      );
      const free = online.filter((c) => !busyIds.has(c.id));
      if (free.length === 0) {
        return [];
      }
      await tx.orderCourierOffer.createMany({
        data: free.map((c) => ({
          orderId,
          courierId: c.id,
          status: OrderOfferStatus.PENDING,
        })),
        skipDuplicates: true,
      });
      return free.map((c) => c.id);
    });
  }
}
