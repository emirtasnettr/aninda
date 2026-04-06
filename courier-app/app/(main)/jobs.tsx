import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JobRouteMiniMap } from '../../src/components/JobRouteMiniMap';
import { fetchCourierMe } from '../../src/lib/api/couriers.api';
import { acceptOrder, fetchOrders } from '../../src/lib/api/orders.api';
import type { CourierProfile, Order } from '../../src/lib/api/types';
import { estRouteMinutes, haversineKm } from '../../src/lib/geo/haversineKm';
import { useReverseGeocodeLabel } from '../../src/hooks/useReverseGeocodeLabel';
import { isActiveDeliveryStatus } from '../../src/lib/courier-active-delivery';
import { colors } from '../../src/theme/colors';

const OFFER_TTL_SEC = 10;
const ACCEPT_BG = '#16a34a';
const ACCEPT_BG_PRESSED = '#15803d';

function courierPayTry(order: Order): number {
  const raw = order.courierEarningAmount;
  if (raw != null && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.round(n * 100) / 100;
  }
  const p = Number(order.price);
  if (!Number.isFinite(p)) return 0;
  return Math.round(p * 0.72 * 100) / 100;
}

function getPendingOffer(order: Order, courierId: string) {
  return order.offers?.find(
    (o) => o.courierId === courierId && o.status === 'PENDING',
  );
}

function percentileValue(sortedAsc: number[], ratio: number): number {
  if (sortedAsc.length === 0) return 0;
  const i = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.floor(sortedAsc.length * ratio)),
  );
  return sortedAsc[i]!;
}

type EnrichedJob = {
  order: Order;
  pay: number;
  distPickup: number;
  routeKm: number;
  estMin: number;
  offerCreatedAt: string;
};

function enrichJob(order: Order, courier: CourierProfile): EnrichedJob | null {
  const offer = getPendingOffer(order, courier.id);
  if (!offer) return null;
  const routeKm =
    Math.round(
      haversineKm(
        order.pickupLat,
        order.pickupLng,
        order.deliveryLat,
        order.deliveryLng,
      ) * 10,
    ) / 10;
  const estMin = estRouteMinutes(routeKm);
  const pay = courierPayTry(order);
  const distPickup =
    courier.lat != null && courier.lng != null
      ? haversineKm(
          courier.lat,
          courier.lng,
          order.pickupLat,
          order.pickupLng,
        )
      : routeKm * 0.35;

  return {
    order,
    pay,
    distPickup,
    routeKm,
    estMin,
    offerCreatedAt: offer.createdAt,
  };
}

function marketScore(e: EnrichedJob, maxPay: number, maxDist: number): number {
  const p = maxPay > 0 ? e.pay / maxPay : 0;
  const d = maxDist > 0 ? 1 - Math.min(1, e.distPickup / maxDist) : 0;
  return 0.52 * p + 0.48 * d;
}

function sortJobMarket(
  list: EnrichedJob[],
): EnrichedJob[] {
  if (list.length === 0) return [];
  const maxPay = Math.max(...list.map((x) => x.pay), 1e-6);
  const maxDist = Math.max(...list.map((x) => x.distPickup), 0.5);
  return [...list].sort(
    (a, b) =>
      marketScore(b, maxPay, maxDist) - marketScore(a, maxPay, maxDist),
  );
}

function badgeThresholds(sorted: EnrichedJob[]) {
  const pays = [...sorted.map((x) => x.pay)].sort((a, b) => a - b);
  const dists = [...sorted.map((x) => x.distPickup)].sort((a, b) => a - b);
  const mins = [...sorted.map((x) => x.estMin)].sort((a, b) => a - b);
  return {
    highPayMin: percentileValue(pays, 0.66),
    nearMaxDist: percentileValue(dists, 0.33),
    fastMaxMin: percentileValue(mins, 0.33),
  };
}

function useOfferSecondsLeft(createdAtIso: string | undefined): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!createdAtIso) {
      setS(0);
      return;
    }
    const end = new Date(createdAtIso).getTime() + OFFER_TTL_SEC * 1000;
    const tick = () =>
      setS(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const i = setInterval(tick, 250);
    return () => clearInterval(i);
  }, [createdAtIso]);
  return s;
}

function formatTry(n: number): string {
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function AddressLines({
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng,
}: {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
}) {
  const pickup = useReverseGeocodeLabel(pickupLat, pickupLng);
  const delivery = useReverseGeocodeLabel(deliveryLat, deliveryLng);
  return (
    <View style={styles.addrBlock}>
      <View style={styles.addrRow}>
        <View style={[styles.addrDot, styles.dotPickup]} />
        <View style={styles.addrTextWrap}>
          <Text style={styles.addrLbl}>Alış</Text>
          <Text style={styles.addrVal} numberOfLines={2}>
            {pickup}
          </Text>
        </View>
      </View>
      <View style={styles.addrRow}>
        <View style={[styles.addrDot, styles.dotDelivery]} />
        <View style={styles.addrTextWrap}>
          <Text style={styles.addrLbl}>Teslimat</Text>
          <Text style={styles.addrVal} numberOfLines={2}>
            {delivery}
          </Text>
        </View>
      </View>
    </View>
  );
}

type Flags = {
  bestToday: boolean;
  dontMiss: boolean;
  highPay: boolean;
  near: boolean;
  fast: boolean;
};

function JobCard({
  item,
  flags,
  accepting,
  onAccept,
  onOpenMaps,
}: {
  item: EnrichedJob;
  flags: Flags;
  accepting: boolean;
  onAccept: () => void;
  onOpenMaps: () => void;
}) {
  const left = useOfferSecondsLeft(item.offerCreatedAt);
  const { order, pay, routeKm, estMin } = item;

  return (
    <View style={styles.card}>
      {(flags.bestToday || flags.dontMiss) && (
        <View style={styles.heroBannerRow}>
          {flags.bestToday ? (
            <View style={styles.heroBanner}>
              <Ionicons name="trophy" size={14} color="#b45309" />
              <Text style={styles.heroBannerText}>Bugünün en iyi işi</Text>
            </View>
          ) : null}
          {flags.dontMiss ? (
            <View style={[styles.heroBanner, styles.heroBannerAlt]}>
              <Ionicons name="flash" size={14} color="#1d4ed8" />
              <Text style={[styles.heroBannerText, styles.heroBannerTextAlt]}>
                Bu işi kaçırma
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.cardTop}>
        <View style={styles.priceCol}>
          <Text style={styles.earnLbl}>Kazanç</Text>
          <Text style={styles.priceHuge}>{formatTry(pay)} ₺</Text>
        </View>
        <View style={styles.countdownBox}>
          <Text style={styles.countdownLbl}>Kalan</Text>
          <Text
            style={[
              styles.countdownVal,
              left <= 3 && styles.countdownUrgent,
            ]}
          >
            {left}s
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Ionicons name="navigate-outline" size={16} color={colors.muted} />
          <Text style={styles.metricVal}>{routeKm} km</Text>
          <Text style={styles.metricLbl}>mesafe</Text>
        </View>
        <View style={styles.metricSep} />
        <View style={styles.metric}>
          <Ionicons name="time-outline" size={16} color={colors.muted} />
          <Text style={styles.metricVal}>~{estMin} dk</Text>
          <Text style={styles.metricLbl}>tahmini</Text>
        </View>
      </View>

      <View style={styles.chips}>
        {flags.highPay ? (
          <View style={[styles.chip, styles.chipGold]}>
            <Text style={styles.chipTextGold}>Yüksek kazanç</Text>
          </View>
        ) : null}
        {flags.near ? (
          <View style={[styles.chip, styles.chipTeal]}>
            <Text style={styles.chipTextTeal}>Yakın</Text>
          </View>
        ) : null}
        {flags.fast ? (
          <View style={[styles.chip, styles.chipBlue]}>
            <Text style={styles.chipTextBlue}>Hızlı</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.mapMargin}>
        <JobRouteMiniMap
          pickupLat={order.pickupLat}
          pickupLng={order.pickupLng}
          deliveryLat={order.deliveryLat}
          deliveryLng={order.deliveryLng}
          onPress={onOpenMaps}
        />
      </View>

      <AddressLines
        pickupLat={order.pickupLat}
        pickupLng={order.pickupLng}
        deliveryLat={order.deliveryLat}
        deliveryLng={order.deliveryLng}
      />

      <Pressable
        onPress={onAccept}
        disabled={accepting}
        style={({ pressed }) => [
          styles.acceptBtn,
          pressed && styles.acceptBtnPressed,
          accepting && styles.acceptBtnDisabled,
        ]}
      >
        {accepting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.acceptBtnText}>Kabul et</Text>
        )}
      </Pressable>
    </View>
  );
}

export default function JobsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: courier } = useQuery({
    queryKey: ['courier', 'me'],
    queryFn: fetchCourierMe,
  });

  const {
    data: orders = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });

  const hasActiveDelivery = useMemo(() => {
    if (!courier) return false;
    return orders.some(
      (o) =>
        o.courierId === courier.id && isActiveDeliveryStatus(o.status),
    );
  }, [orders, courier]);

  const enrichedSorted = useMemo(() => {
    if (!courier || hasActiveDelivery) return [];
    const raw = orders.filter(
      (o) =>
        o.status === 'SEARCHING_COURIER' &&
        o.offers?.some(
          (of) => of.courierId === courier.id && of.status === 'PENDING',
        ),
    );
    const enriched = raw
      .map((o) => enrichJob(o, courier))
      .filter((x): x is EnrichedJob => x != null);
    return sortJobMarket(enriched);
  }, [orders, courier, hasActiveDelivery]);

  const thresholds = useMemo(
    () => badgeThresholds(enrichedSorted),
    [enrichedSorted],
  );

  const acceptMut = useMutation({
    mutationFn: (orderId: string) => acceptOrder(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['courier', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['earnings', 'summary'] });
    },
    onError: () => {
      Alert.alert('Hata', 'İş başka bir kurye tarafından alınmış olabilir.');
    },
  });

  const openDirections = (o: Order) => {
    const url = `https://www.google.com/maps/dir/${o.pickupLat},${o.pickupLng}/${o.deliveryLat},${o.deliveryLng}`;
    void Linking.openURL(url);
  };

  const flagsFor = (item: EnrichedJob, index: number): Flags => {
    const { highPayMin, nearMaxDist, fastMaxMin } = thresholds;
    return {
      bestToday: index === 0 && enrichedSorted.length > 0,
      dontMiss: index === 1 && enrichedSorted.length >= 2,
      highPay: item.pay >= highPayMin,
      near: item.distPickup <= nearMaxDist,
      fast: item.estMin <= fastMaxMin,
    };
  };

  if (!courier) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={enrichedSorted}
          keyExtractor={(x) => x.order.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHead}>
              {hasActiveDelivery ? (
                <>
                  <View style={styles.busyBanner}>
                    <Ionicons name="bicycle" size={22} color={colors.primary} />
                    <View style={styles.busyBannerTextWrap}>
                      <Text style={styles.busyBannerTitle}>Aktif teslimatın var</Text>
                      <Text style={styles.busyBannerSub}>
                        Yeni iş alamazsın. Mevcut siparişi tamamlayınca veya iptal
                        olunca iş pazarı tekrar açılır.
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.marketTitle}>İş pazarı</Text>
                  <Text style={styles.marketSub}>
                    Kazanç ve yakınlığa göre sıralı — en iyi üstte
                  </Text>
                </>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <JobCard
              item={item}
              flags={flagsFor(item, index)}
              accepting={
                acceptMut.isPending && acceptMut.variables === item.order.id
              }
              onAccept={() =>
                acceptMut.mutate(item.order.id, {
                  onSuccess: (order) => {
                    router.replace(`/(main)/delivery/${order.id}`);
                  },
                })
              }
              onOpenMaps={() => openDirections(item.order)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons
                name={hasActiveDelivery ? 'navigate-circle-outline' : 'briefcase-outline'}
                size={48}
                color={colors.muted}
              />
              <Text style={styles.emptyTitle}>
                {hasActiveDelivery ? 'Aktif teslimatın var' : 'Şu an teklif yok'}
              </Text>
              <Text style={styles.emptyText}>
                {hasActiveDelivery
                  ? 'Önce aktif siparişini bitir; ardından yeni teklifler burada görünür.'
                  : 'Çevrimiçi olduğunuzda yeni işler burada belirir. Ana sayfadan bildirimleri açık tutun.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 14, paddingBottom: 28 },
  listHead: { paddingTop: 4, paddingBottom: 12 },
  busyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.surfaceTint,
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  busyBannerTextWrap: { flex: 1, minWidth: 0 },
  busyBannerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  busyBannerSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 19,
    fontWeight: '600',
  },
  marketTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  marketSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  heroBannerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  heroBannerAlt: { backgroundColor: '#dbeafe' },
  heroBannerText: { fontSize: 12, fontWeight: '800', color: '#92400e' },
  heroBannerTextAlt: { color: '#1e40af' },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  priceCol: { flex: 1, minWidth: 0 },
  earnLbl: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  priceHuge: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.text,
    marginTop: 2,
    letterSpacing: -1,
  },
  countdownBox: {
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceTint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 72,
  },
  countdownLbl: { fontSize: 10, fontWeight: '700', color: colors.muted },
  countdownVal: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
    marginTop: 2,
  },
  countdownUrgent: { color: colors.danger },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: colors.surfaceTint,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metric: { flex: 1, alignItems: 'center' },
  metricSep: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: colors.border,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  metricLbl: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chipGold: { backgroundColor: '#fff7ed' },
  chipTextGold: { fontSize: 11, fontWeight: '800', color: '#c2410c' },
  chipTeal: { backgroundColor: '#ecfdf5' },
  chipTextTeal: { fontSize: 11, fontWeight: '800', color: '#047857' },
  chipBlue: { backgroundColor: '#eff6ff' },
  chipTextBlue: { fontSize: 11, fontWeight: '800', color: '#1d4ed8' },
  mapMargin: { marginTop: 10 },
  addrBlock: { marginTop: 10, gap: 8 },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addrDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  dotPickup: { backgroundColor: '#38bdf8' },
  dotDelivery: { backgroundColor: '#f87171' },
  addrTextWrap: { flex: 1, minWidth: 0 },
  addrLbl: { fontSize: 10, fontWeight: '800', color: colors.muted },
  addrVal: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 },
  acceptBtn: {
    marginTop: 14,
    backgroundColor: ACCEPT_BG,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  acceptBtnPressed: { backgroundColor: ACCEPT_BG_PRESSED },
  acceptBtnDisabled: { opacity: 0.65 },
  acceptBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    fontWeight: '500',
  },
});
