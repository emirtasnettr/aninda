import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { JobRouteMiniMap } from './JobRouteMiniMap';
import { updateOrderStatus } from '../lib/api/orders.api';
import type { Order } from '../lib/api/types';
import { estRouteMinutes, haversineKm } from '../lib/geo/haversineKm';
import { useReverseGeocodeLabel } from '../hooks/useReverseGeocodeLabel';
import {
  ACTIVE_DELIVERY_STATUSES,
  isActiveDeliveryStatus,
} from '../lib/courier-active-delivery';
import { colors } from '../theme/colors';

export { ACTIVE_DELIVERY_STATUSES, isActiveDeliveryStatus };

export const DELIVERY_SLA_MS = 45 * 60 * 1000;

const ACCENT = '#0f766e';

function openFullRoute(o: Order): void {
  const url = `https://www.google.com/maps/dir/${o.pickupLat},${o.pickupLng}/${o.deliveryLat},${o.deliveryLng}`;
  void Linking.openURL(url);
}

function openPhaseNav(
  o: Order,
  courierLat: number | null | undefined,
  courierLng: number | null | undefined,
): void {
  if (o.status === 'ACCEPTED') {
    const from =
      courierLat != null && courierLng != null
        ? `${courierLat},${courierLng}`
        : `${o.pickupLat},${o.pickupLng}`;
    void Linking.openURL(
      `https://www.google.com/maps/dir/${from}/${o.pickupLat},${o.pickupLng}`,
    );
    return;
  }
  const dest = `${o.deliveryLat},${o.deliveryLng}`;
  const from =
    courierLat != null && courierLng != null
      ? `${courierLat},${courierLng}`
      : `${o.pickupLat},${o.pickupLng}`;
  void Linking.openURL(`https://www.google.com/maps/dir/${from}/${dest}`);
}

function statusHeadline(status: string): string {
  const m: Record<string, string> = {
    ACCEPTED: 'Alış noktasına gidiyorsun',
    PICKED_UP: 'Teslimata hazırlanıyorsun',
    ON_DELIVERY: 'Teslimata gidiyorsun',
  };
  return m[status] ?? status;
}

function AddressPair({
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
  const p = useReverseGeocodeLabel(pickupLat, pickupLng);
  const d = useReverseGeocodeLabel(deliveryLat, deliveryLng);
  return (
    <View style={styles.addrBlock}>
      <View style={styles.addrRow}>
        <View style={[styles.addrDot, { backgroundColor: '#38bdf8' }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.addrLbl}>Alış</Text>
          <Text style={styles.addrTxt} numberOfLines={2}>
            {p}
          </Text>
        </View>
      </View>
      <View style={styles.addrRow}>
        <View style={[styles.addrDot, { backgroundColor: '#f87171' }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.addrLbl}>Teslimat</Text>
          <Text style={styles.addrTxt} numberOfLines={2}>
            {d}
          </Text>
        </View>
      </View>
    </View>
  );
}

type Props = {
  order: Order;
  courierLat?: number | null;
  courierLng?: number | null;
  nowMs: number;
  onOpenDeliveryScreen?: () => void;
};

export function ActiveDeliveryFocusCard({
  order,
  courierLat,
  courierLng,
  nowMs,
  onOpenDeliveryScreen,
}: Props) {
  const queryClient = useQueryClient();

  const statusMut = useMutation({
    mutationFn: (status: string) => updateOrderStatus(order.id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order', order.id] });
    },
    onError: () => {
      Alert.alert('Hata', 'Durum güncellenemedi.');
    },
  });

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

  let legKm = routeKm;
  if (courierLat != null && courierLng != null) {
    if (order.status === 'ACCEPTED') {
      legKm =
        Math.round(
          haversineKm(
            courierLat,
            courierLng,
            order.pickupLat,
            order.pickupLng,
          ) * 10,
        ) / 10;
    } else {
      legKm =
        Math.round(
          haversineKm(
            courierLat,
            courierLng,
            order.deliveryLat,
            order.deliveryLng,
          ) * 10,
        ) / 10;
    }
  }

  const elapsed = nowMs - new Date(order.createdAt).getTime();
  const remainingMin = Math.ceil((DELIVERY_SLA_MS - elapsed) / 60_000);
  const overdue = elapsed > DELIVERY_SLA_MS;

  const pending = statusMut.isPending;
  const canPickUp = order.status === 'ACCEPTED';
  const canLeaveForDelivery = order.status === 'PICKED_UP';
  const canDeliver = order.status === 'ON_DELIVERY';

  return (
    <View style={styles.card}>
      <View style={styles.topBar}>
        <View style={styles.liveDot} />
        <Text style={styles.liveTxt}>Aktif teslimat</Text>
        <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
      </View>

      <Text style={styles.headline}>{statusHeadline(order.status)}</Text>

      {overdue ? (
        <View style={styles.overdueBanner}>
          <Ionicons name="warning" size={20} color="#fff" />
          <Text style={styles.overdueTxt}>Süre hedefini aştın</Text>
        </View>
      ) : (
        <View style={styles.slaRow}>
          <Ionicons name="time-outline" size={18} color={ACCENT} />
          <Text style={styles.slaTxt}>
            {remainingMin > 0
              ? `Hedef süre: ~${remainingMin} dk kaldı (45′)`
              : 'Son dakika — hedef süreye yaklaşıyorsun'}
          </Text>
        </View>
      )}

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricVal}>{legKm.toFixed(1)} km</Text>
          <Text style={styles.metricLbl}>
            {order.status === 'ACCEPTED' ? 'Alışa mesafe' : 'Teslimata mesafe'}
          </Text>
        </View>
        <View style={styles.metricSep} />
        <View style={styles.metric}>
          <Text style={styles.metricVal}>{routeKm} km</Text>
          <Text style={styles.metricLbl}>Güzergah</Text>
        </View>
        <View style={styles.metricSep} />
        <View style={styles.metric}>
          <Text style={styles.metricVal}>~{estMin} dk</Text>
          <Text style={styles.metricLbl}>Tahmini</Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <JobRouteMiniMap
          pickupLat={order.pickupLat}
          pickupLng={order.pickupLng}
          deliveryLat={order.deliveryLat}
          deliveryLng={order.deliveryLng}
          onPress={() => openFullRoute(order)}
        />
      </View>

      <AddressPair
        pickupLat={order.pickupLat}
        pickupLng={order.pickupLng}
        deliveryLat={order.deliveryLat}
        deliveryLng={order.deliveryLng}
      />

      <Pressable
        style={({ pressed }) => [styles.btnMap, pressed && { opacity: 0.92 }]}
        onPress={() => openPhaseNav(order, courierLat, courierLng)}
      >
        <Ionicons name="navigate" size={22} color="#fff" />
        <Text style={styles.btnMapTxt}>Haritaya git</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.btnPickUp,
          !canPickUp && styles.btnDisabled,
          pressed && canPickUp && { opacity: 0.92 },
        ]}
        disabled={!canPickUp || pending}
        onPress={() => statusMut.mutate('PICKED_UP')}
      >
        {pending && canPickUp ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="bag-handle-outline" size={22} color="#fff" />
            <Text style={styles.btnPickUpTxt}>Paketi aldım</Text>
          </>
        )}
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.btnPickUp,
          styles.btnAmber,
          !canLeaveForDelivery && styles.btnDisabled,
          pressed && canLeaveForDelivery && { opacity: 0.92 },
        ]}
        disabled={!canLeaveForDelivery || pending}
        onPress={() => statusMut.mutate('ON_DELIVERY')}
      >
        {pending && canLeaveForDelivery ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="car-outline" size={22} color="#fff" />
            <Text style={styles.btnPickUpTxt}>Teslimata çık</Text>
          </>
        )}
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.btnPickUp,
          styles.btnDeliver,
          !canDeliver && styles.btnDisabled,
          pressed && canDeliver && { opacity: 0.92 },
        ]}
        disabled={!canDeliver || pending}
        onPress={() => statusMut.mutate('DELIVERED')}
      >
        {pending && canDeliver ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
            <Text style={styles.btnPickUpTxt}>Teslim ettim</Text>
          </>
        )}
      </Pressable>

      {onOpenDeliveryScreen ? (
        <Pressable
          onPress={onOpenDeliveryScreen}
          style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="map-outline" size={18} color={colors.primary} />
          <Text style={styles.btnGhostTxt}>Tam ekran harita & detay</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 2,
    borderColor: '#99f6e4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  liveTxt: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  orderId: { fontSize: 12, fontWeight: '700', color: colors.muted },
  headline: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 12,
    lineHeight: 28,
  },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.danger,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  overdueTxt: { color: '#fff', fontSize: 15, fontWeight: '800', flex: 1 },
  slaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  slaTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: '#065f46' },
  metrics: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceTint,
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  metric: { flex: 1, alignItems: 'center' },
  metricSep: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  metricVal: { fontSize: 17, fontWeight: '900', color: colors.text },
  metricLbl: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  mapWrap: { marginBottom: 12 },
  addrBlock: { gap: 10, marginBottom: 14 },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addrDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  addrLbl: { fontSize: 10, fontWeight: '800', color: colors.muted },
  addrTxt: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
  btnMap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  btnMapTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
  btnPickUp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 10,
    minHeight: 56,
  },
  btnPickUpTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
  btnAmber: { backgroundColor: '#d97706' },
  btnDeliver: { backgroundColor: '#15803d' },
  btnDisabled: { opacity: 0.38 },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
  },
  btnGhostTxt: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
