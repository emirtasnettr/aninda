import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchOrder } from '../../../src/lib/api/orders.api';
import type { CourierLocationPayload } from '../../../src/lib/api/types';
import {
  connectRealtimeSocket,
  disconnectRealtimeSocket,
  joinOrderTracking,
  leaveOrderTracking,
  offCourierLocation,
  onCourierLocation,
} from '../../../src/lib/socket/realtime';
import { useAuthStore } from '../../../src/store/authStore';
import { colors } from '../../../src/theme/colors';

export default function OrderTrackingScreen() {
  const raw = useLocalSearchParams<{ orderId: string | string[] }>();
  const orderId = Array.isArray(raw.orderId) ? raw.orderId[0] : raw.orderId;
  const token = useAuthStore((s) => s.token);
  const [live, setLive] = useState<CourierLocationPayload | null>(null);
  const mapRef = useRef<MapView>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId!),
    enabled: Boolean(orderId),
    refetchInterval: 15_000,
  });

  const courierCoord = useMemo(() => {
    if (live) {
      return { latitude: live.lat, longitude: live.lng };
    }
    if (
      order?.courier?.lat != null &&
      order?.courier?.lng != null
    ) {
      return {
        latitude: order.courier.lat,
        longitude: order.courier.lng,
      };
    }
    return null;
  }, [live, order?.courier?.lat, order?.courier?.lng]);

  useEffect(() => {
    if (!token || !orderId) return;

    const sock = connectRealtimeSocket(token);
    joinOrderTracking(orderId);

    const handler = (p: CourierLocationPayload) => {
      if (p.orderId === orderId) {
        setLive(p);
      }
    };
    onCourierLocation(handler);

    return () => {
      leaveOrderTracking(orderId);
      offCourierLocation(handler);
      disconnectRealtimeSocket();
      setLive(null);
    };
  }, [orderId, token]);

  useEffect(() => {
    if (!order) return;
    const coords = [
      { latitude: order.pickupLat, longitude: order.pickupLng },
      { latitude: order.deliveryLat, longitude: order.deliveryLng },
    ];
    if (courierCoord) {
      coords.push(courierCoord);
    }
    const id = requestAnimationFrame(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 52, right: 36, bottom: 52, left: 36 },
        animated: true,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [
    order,
    courierCoord?.latitude,
    courierCoord?.longitude,
    live?.lat,
    live?.lng,
  ]);

  if (!orderId || isLoading || !order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Sipariş takibi</Text>
        <Text style={styles.id}>#{order.id}</Text>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{order.status}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Tutar</Text>
          <Text style={styles.value}>{order.price} ₺</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Harita</Text>
          <Text style={styles.mapHint}>
            Yeşil: alış · Kırmızı: teslimat · Siyah: kurye (canlı)
          </Text>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: order.pickupLat,
              longitude: order.pickupLng,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }}
            showsUserLocation={false}
          >
            <Circle
              center={{
                latitude: order.pickupLat,
                longitude: order.pickupLng,
              }}
              radius={45}
              strokeColor="#171717"
              fillColor="rgba(23, 23, 23, 0.2)"
            />
            <Circle
              center={{
                latitude: order.deliveryLat,
                longitude: order.deliveryLng,
              }}
              radius={45}
              strokeColor="#dc2626"
              fillColor="rgba(239, 68, 68, 0.35)"
            />
            {courierCoord ? (
              <Circle
                center={courierCoord}
                radius={42}
                strokeColor="#171717"
                fillColor="rgba(23, 23, 23, 0.45)"
              />
            ) : null}
          </MapView>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Alış</Text>
          <Text style={styles.coords}>
            {order.pickupLat.toFixed(5)}, {order.pickupLng.toFixed(5)}
          </Text>
        </View>
        <View style={styles.block}>
          <Text style={styles.label}>Teslimat</Text>
          <Text style={styles.coords}>
            {order.deliveryLat.toFixed(5)}, {order.deliveryLng.toFixed(5)}
          </Text>
        </View>

        <View style={[styles.block, styles.liveBox]}>
          <Text style={styles.label}>Kurye konumu (canlı)</Text>
          {live ? (
            <>
              <Text style={styles.coords}>
                {live.lat.toFixed(5)}, {live.lng.toFixed(5)}
              </Text>
              <Text style={styles.time}>{new Date(live.at).toLocaleString('tr-TR')}</Text>
            </>
          ) : order.courierId ? (
            <Text style={styles.wait}>Kurye yoldayken konum güncellemeleri burada görünür.</Text>
          ) : (
            <Text style={styles.wait}>Henüz kurye atanmadı.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  id: { fontSize: 14, color: colors.muted, marginTop: 4 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: { color: colors.primaryDark, fontWeight: '700' },
  block: { marginTop: 18 },
  label: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  value: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 4 },
  coords: { fontSize: 15, color: colors.text, marginTop: 4 },
  liveBox: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  time: { fontSize: 12, color: colors.muted, marginTop: 6 },
  wait: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20 },
  map: {
    width: '100%',
    height: 260,
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
  },
  mapHint: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 17,
  },
});
