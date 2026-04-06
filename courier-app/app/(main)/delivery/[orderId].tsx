import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { ComponentRef } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { fetchCourierMe } from '../../../src/lib/api/couriers.api';
import { fetchOrder, updateOrderStatus } from '../../../src/lib/api/orders.api';
import { useCourierLocationSync } from '../../../src/hooks/useCourierLocationSync';
import { useDeliveryRoute } from '../../../src/hooks/useDeliveryRoute';
import type { LatLng } from '../../../src/lib/routing/osrmRoute';
import { colors } from '../../../src/theme/colors';

const NEXT_STATUS: Record<string, string | null> = {
  ACCEPTED: 'PICKED_UP',
  PICKED_UP: 'ON_DELIVERY',
  ON_DELIVERY: 'DELIVERED',
  DELIVERED: null,
};

const ACTION_LABEL: Record<string, string> = {
  PICKED_UP: 'Paketi aldım',
  ON_DELIVERY: 'Teslimata çık',
  DELIVERED: 'Teslim ettim',
};

const PHASE_MESSAGE: Record<string, string> = {
  ACCEPTED: 'Alış noktasına gidin',
  PICKED_UP: 'Paket alındı — teslimat adresine gidin',
  ON_DELIVERY: 'Teslimat adresine gidin',
  DELIVERED: 'Teslimat tamamlandı',
};

function formatKm(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatEta(seconds: number): string {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return `~${m} dk`;
}

function openGoogleDirections(from: LatLng | null, to: LatLng): void {
  const url = from
    ? `https://www.google.com/maps/dir/${from.latitude},${from.longitude}/${to.latitude},${to.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${to.latitude},${to.longitude}`;
  void Linking.openURL(url);
}

export default function ActiveDeliveryScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const mapRef = useRef<ComponentRef<typeof MapView>>(null);

  const [courierPos, setCourierPos] = useState<LatLng | null>(null);

  const { data: courier } = useQuery({
    queryKey: ['courier', 'me'],
    queryFn: fetchCourierMe,
  });

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: Boolean(orderId),
  });

  const isAssignedCourier = order && courier && order.courierId === courier.id;

  useCourierLocationSync(
    Boolean(isAssignedCourier && courier?.isOnline),
    courier?.id,
    {
      aggressive: true,
      onPosition: (lat, lng) => setCourierPos({ latitude: lat, longitude: lng }),
    },
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) return;
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!alive) return;
        setCourierPos((prev) => prev ?? {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch {
        /* */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const destination: LatLng | null = useMemo(() => {
    if (!order) return null;
    if (order.status === 'ACCEPTED') {
      return { latitude: order.pickupLat, longitude: order.pickupLng };
    }
    if (order.status === 'PICKED_UP' || order.status === 'ON_DELIVERY') {
      return { latitude: order.deliveryLat, longitude: order.deliveryLng };
    }
    return null;
  }, [order]);

  const routeOrigin: LatLng | null = useMemo(() => {
    if (!order || !destination) return null;
    if (courierPos) return courierPos;
    if (order.status === 'ACCEPTED') {
      return {
        latitude: order.pickupLat - 0.008,
        longitude: order.pickupLng - 0.008,
      };
    }
    return {
      latitude: order.pickupLat,
      longitude: order.pickupLng,
    };
  }, [order, destination, courierPos]);

  const route = useDeliveryRoute(routeOrigin, destination, 40_000);

  const statusMut = useMutation({
    mutationFn: (status: string) => updateOrderStatus(orderId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const fitMap = useCallback(() => {
    const pts: LatLng[] = [];
    if (courierPos) pts.push(courierPos);
    if (destination) pts.push(destination);
    if (route.coordinates.length > 1) {
      pts.push(...route.coordinates.filter((_, i) => i % 4 === 0));
    }
    if (pts.length < 2 && destination && routeOrigin) {
      pts.push(routeOrigin, destination);
    }
    if (pts.length < 1) return;
    mapRef.current?.fitToCoordinates(
      pts.map((p) => ({ ...p })),
      {
        edgePadding: {
          top: insets.top + 56,
          right: 28,
          bottom: 220 + insets.bottom,
          left: 28,
        },
        animated: true,
      },
    );
  }, [courierPos, destination, route.coordinates, routeOrigin, insets.top, insets.bottom]);

  useEffect(() => {
    const t = setTimeout(fitMap, 400);
    return () => clearTimeout(t);
  }, [fitMap, order?.status, route.coordinates.length]);

  if (!orderId || isLoading || !order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAssignedCourier) {
    return (
      <View style={[styles.center, styles.errorPad]}>
        <Text style={styles.error}>Bu sipariş size atanmamış.</Text>
        <PrimaryButton title="Geri" onPress={() => router.back()} />
      </View>
    );
  }

  const finished = order.status === 'DELIVERED' || order.status === 'CANCELLED';
  const nextStatus = NEXT_STATUS[order.status];
  const phaseMsg =
    PHASE_MESSAGE[order.status] ?? order.status;
  const actionLabel = nextStatus ? ACTION_LABEL[nextStatus] ?? nextStatus : '';

  const showMap = Platform.OS !== 'web';

  if (finished) {
    return (
      <View style={styles.doneWrap}>
        <StatusBar style="dark" />
        <View style={styles.doneCard}>
          <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          <Text style={styles.doneTitle}>
            {order.status === 'DELIVERED' ? 'Teslimat tamamlandı' : 'Sipariş kapandı'}
          </Text>
          <Text style={styles.doneSub}>#{order.id.slice(0, 10)}</Text>
          <PrimaryButton
            title="Ana sayfaya dön"
            onPress={() => router.replace('/(main)/dashboard')}
            style={styles.doneBtn}
          />
        </View>
      </View>
    );
  }

  if (!destination || !routeOrigin) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {showMap ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          mapType="standard"
          showsCompass={false}
          toolbarEnabled={false}
          onMapReady={fitMap}
        >
          {route.coordinates.length >= 2 ? (
            <Polyline
              coordinates={route.coordinates}
              strokeColor="#2563eb"
              strokeWidth={5}
            />
          ) : null}
          <Marker
            coordinate={destination}
            title={order.status === 'ACCEPTED' ? 'Alış' : 'Teslim'}
            pinColor={order.status === 'ACCEPTED' ? '#16a34a' : colors.danger}
          />
          {courierPos ? (
            <>
              <Circle
                center={courierPos}
                radius={42}
                strokeColor="#2563eb"
                fillColor="rgba(37,99,235,0.2)"
                strokeWidth={2}
              />
              <Marker coordinate={courierPos} title="Konumunuz">
                <View style={styles.courierDot} />
              </Marker>
            </>
          ) : null}
        </MapView>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.webFallback]}>
          <Text style={styles.webFallbackTitle}>Harita (web önizleme)</Text>
          <Text style={styles.webFallbackTxt}>
            Mobil uygulamada tam ekran harita açılır.
          </Text>
        </View>
      )}

      <Pressable
        style={[styles.backBtn, { top: insets.top + 8 }]}
        onPress={() => router.back()}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={26} color="#fff" />
      </Pressable>

      <Pressable
        style={[styles.navFab, { top: insets.top + 8 }]}
        onPress={() => openGoogleDirections(courierPos, destination)}
      >
        <Ionicons name="navigate" size={22} color={colors.primary} />
        <Text style={styles.navFabText}>Google Maps</Text>
      </Pressable>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.phase}>{phaseMsg}</Text>
        <Text style={styles.orderRef}>#{order.id.slice(0, 8)} · {order.price} ₺</Text>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLab}>Kalan mesafe</Text>
            <Text style={styles.metricVal}>
              {route.loading ? '…' : formatKm(route.distanceMeters)}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricLab}>Tahmini süre</Text>
            <Text style={styles.metricVal}>
              {route.loading ? '…' : formatEta(route.durationSeconds)}
            </Text>
          </View>
        </View>

        {nextStatus ? (
          <PrimaryButton
            title={actionLabel}
            loading={statusMut.isPending}
            onPress={() =>
              statusMut.mutate(nextStatus, {
                onError: () => Alert.alert('Hata', 'Durum güncellenemedi.'),
              })
            }
            style={styles.primaryBtn}
          />
        ) : null}

        <Pressable
          style={styles.mapsLink}
          onPress={() => openGoogleDirections(courierPos, destination)}
        >
          <Ionicons name="map-outline" size={18} color={colors.primary} />
          <Text style={styles.mapsLinkText}>Haritada yönlendirme aç</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorPad: { padding: 24 },
  error: { fontSize: 16, color: colors.danger, marginBottom: 16, textAlign: 'center' },
  courierDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2563eb',
    borderWidth: 3,
    borderColor: '#fff',
  },
  backBtn: {
    position: 'absolute',
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navFab: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  navFabText: { fontSize: 14, fontWeight: '800', color: colors.primary },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  phase: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  orderRef: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 14,
  },
  metrics: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  metric: { flex: 1 },
  metricLab: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricVal: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 4,
  },
  metricDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  primaryBtn: {
    minHeight: 54,
    borderRadius: 14,
  },
  mapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
  },
  mapsLinkText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  webFallback: {
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  webFallbackTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  webFallbackTxt: { color: '#a1a1aa', marginTop: 8, textAlign: 'center' },
  doneWrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  doneCard: { alignItems: 'center', maxWidth: 320 },
  doneTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  doneSub: { fontSize: 14, color: colors.muted, marginTop: 6 },
  doneBtn: { marginTop: 24, alignSelf: 'stretch' },
});
