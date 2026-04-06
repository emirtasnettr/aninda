import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { formatApiError } from '../../src/lib/api/error-message';
import { fetchCourierMe, patchCourierMe } from '../../src/lib/api/couriers.api';
import {
  acceptOrder,
  declineOrderOffer,
  fetchOrders,
} from '../../src/lib/api/orders.api';
import {
  ActiveDeliveryFocusCard,
  isActiveDeliveryStatus,
} from '../../src/components/ActiveDeliveryFocusCard';
import { estRouteMinutes, haversineKm } from '../../src/lib/geo/haversineKm';
import { staticMapUri } from '../../src/lib/geo/staticMapUri';
import { useCourierLocationSync } from '../../src/hooks/useCourierLocationSync';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';

const ISTANBUL = { lat: 41.0082, lng: 28.9784 };

function MiniMapPreview({
  centerLat,
  centerLng,
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng,
  onOpenMaps,
  caption,
}: {
  centerLat: number;
  centerLng: number;
  pickupLat?: number;
  pickupLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  onOpenMaps: () => void;
  caption: string;
}) {
  const [imgErr, setImgErr] = useState(false);
  const markers =
    pickupLat != null &&
    pickupLng != null &&
    deliveryLat != null &&
    deliveryLng != null
      ? [
          { lat: pickupLat, lng: pickupLng, color: 'lightblue1' },
          { lat: deliveryLat, lng: deliveryLng, color: 'red1' },
        ]
      : undefined;
  const uri = staticMapUri(
    centerLat,
    centerLng,
    markers ? 12 : 11,
    markers,
    '720x260',
  );

  return (
    <Pressable
      onPress={onOpenMaps}
      style={({ pressed }) => [styles.mapCard, pressed && { opacity: 0.92 }]}
    >
      {!imgErr ? (
        <Image
          source={{ uri }}
          style={styles.mapImage}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
      ) : (
        <View style={[styles.mapImage, styles.mapFallback]}>
          <Ionicons name="map-outline" size={40} color={colors.muted} />
          <Text style={styles.mapFallbackText}>Harita önizlemesi yüklenemedi</Text>
        </View>
      )}
      <View style={styles.mapOverlay}>
        <Text style={styles.mapCaption}>{caption}</Text>
        <View style={styles.mapChip}>
          <Text style={styles.mapChipText}>Haritada aç</Text>
          <Ionicons name="open-outline" size={16} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const [now, setNow] = useState(() => Date.now());
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const {
    data: courier,
    isLoading: loadingCourier,
    isError: courierError,
    error: courierErr,
    refetch: refetchCourier,
  } = useQuery({
    queryKey: ['courier', 'me'],
    queryFn: fetchCourierMe,
  });

  const {
    data: orders = [],
    isLoading: loadingOrders,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });

  const activeOrder = useMemo(() => {
    if (!courier) return undefined;
    return orders.find(
      (o) => o.courierId === courier.id && isActiveDeliveryStatus(o.status),
    );
  }, [orders, courier]);

  useEffect(() => {
    const hasActive = orders.some(
      (o) =>
        courier &&
        o.courierId === courier.id &&
        isActiveDeliveryStatus(o.status),
    );
    const ms = hasActive ? 10_000 : 30_000;
    const i = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(i);
  }, [orders, courier]);

  const jobOffers = useMemo(() => {
    if (!courier) return [];
    const list = orders.filter(
      (o) =>
        o.status === 'SEARCHING_COURIER' &&
        o.offers?.some(
          (of) => of.courierId === courier.id && of.status === 'PENDING',
        ),
    );
    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [orders, courier]);

  const incomingJob = jobOffers[0];

  const toggleOnline = useMutation({
    mutationFn: (isOnline: boolean) => patchCourierMe({ isOnline }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courier', 'me'] });
    },
  });

  const acceptMut = useMutation({
    mutationFn: (orderId: string) => acceptOrder(orderId),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['courier', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['earnings', 'summary'] });
      router.push(`/(main)/delivery/${order.id}`);
    },
    onError: () => {
      Alert.alert('Hata', 'İş başka bir kurye tarafından alınmış olabilir.');
    },
  });

  const declineMut = useMutation({
    mutationFn: (orderId: string) => declineOrderOffer(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => {
      Alert.alert('Hata', 'Teklif reddedilemedi veya süresi dolmuş olabilir.');
    },
  });

  useCourierLocationSync(Boolean(courier?.isOnline), courier?.id);

  const displayName =
    courier?.fullName?.trim() ||
    courier?.user.email.split('@')[0] ||
    'Kurye';

  const online = Boolean(courier?.isOnline);

  const onRefresh = () => {
    setPullRefreshing(true);
    void Promise.all([refetchCourier(), refetchOrders()]).finally(() =>
      setPullRefreshing(false),
    );
  };

  if (loadingCourier) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (courierError) {
    return (
      <View style={[styles.center, styles.errorPad]}>
        <Text style={styles.errorTitle}>Profil yüklenemedi</Text>
        <Text style={styles.errorText}>{formatApiError(courierErr)}</Text>
        <Text style={styles.errorHint}>
          Kurye profili yoksa: kök dizinde `npx prisma db seed` çalıştırın veya uygulamadan
          kurye olarak kayıt olun.
        </Text>
        <PrimaryButton title="Tekrar dene" onPress={() => refetchCourier()} style={styles.mtSm} />
        <PrimaryButton
          title="Çıkış yap"
          variant="outline"
          onPress={async () => {
            await logout();
            router.replace('/(auth)/login');
          }}
          style={styles.mtSm}
        />
      </View>
    );
  }

  const mapCenter =
    courier?.lat != null && courier?.lng != null
      ? { lat: courier.lat, lng: courier.lng }
      : ISTANBUL;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={pullRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* En üst: hoş geldin + çevrimiçi */}
        <View style={styles.welcomeBlock}>
          <Text style={styles.welcomeHi}>Hoş geldin,</Text>
          <Text style={styles.welcomeName} numberOfLines={2}>
            {displayName}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.cardTitle}>Çevrimiçi ol</Text>
              <Text style={styles.toggleHint}>
                {online
                  ? 'İş almaya hazırsın'
                  : 'Şu an iş almıyorsun'}
              </Text>
            </View>
            <View style={styles.switchWrap}>
              <Switch
                value={online}
                onValueChange={(v) => toggleOnline.mutate(v)}
                disabled={toggleOnline.isPending}
                trackColor={{ true: colors.success, false: colors.border }}
                thumbColor={colors.card}
              />
            </View>
          </View>
        </View>

        {/* Aktif teslimat — odak */}
        {activeOrder ? (
          <>
            <View style={styles.focusStrip}>
              <Ionicons name="radio-button-on" size={14} color={colors.success} />
              <Text style={styles.focusStripTxt}>Odak modu · önce bu teslimat</Text>
            </View>
            <ActiveDeliveryFocusCard
              order={activeOrder}
              courierLat={courier?.lat ?? null}
              courierLng={courier?.lng ?? null}
              nowMs={now}
              onOpenDeliveryScreen={() =>
                router.push(`/(main)/delivery/${activeOrder.id}`)
              }
            />
            <View style={styles.busyNotice}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
              <Text style={styles.busyNoticeText}>
                Aktif teslimatın var. Bu süre boyunca yeni iş teklifi alamazsın; önce
                mevcut siparişi tamamla veya iptal durumunu bekle.
              </Text>
            </View>
          </>
        ) : null}

        {/* Gelen iş — aktif teslimat varken dağıtmamak için gizle */}
        {!activeOrder && incomingJob ? (
          <View style={[styles.card, styles.incomingCard]}>
            <View style={styles.incomingTop}>
              <Ionicons name="flash" size={22} color={colors.warning} />
              <Text style={styles.incomingTitle}>Yeni iş teklifi</Text>
            </View>
            <Text style={styles.incomingId}>#{incomingJob.id.slice(0, 8)}</Text>
            <View style={styles.incomingStats}>
              <View style={styles.statBox}>
                <Text style={styles.statLab}>Mesafe</Text>
                <Text style={styles.statVal}>
                  {haversineKm(
                    incomingJob.pickupLat,
                    incomingJob.pickupLng,
                    incomingJob.deliveryLat,
                    incomingJob.deliveryLng,
                  ).toFixed(1)}{' '}
                  km
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLab}>Ücret</Text>
                <Text style={styles.statVal}>{incomingJob.price} ₺</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLab}>Süre ~</Text>
                <Text style={styles.statVal}>
                  {estRouteMinutes(
                    haversineKm(
                      incomingJob.pickupLat,
                      incomingJob.pickupLng,
                      incomingJob.deliveryLat,
                      incomingJob.deliveryLng,
                    ),
                  )}{' '}
                  dk
                </Text>
              </View>
            </View>
            <View style={styles.incomingActions}>
              <PrimaryButton
                title="Kabul et"
                loading={acceptMut.isPending && acceptMut.variables === incomingJob.id}
                onPress={() => acceptMut.mutate(incomingJob.id)}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Reddet"
                variant="outline"
                loading={declineMut.isPending && declineMut.variables === incomingJob.id}
                onPress={() => declineMut.mutate(incomingJob.id)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : null}

        {/* Aktif iş yokken bölge / teklif özeti */}
        {!activeOrder ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Şu an aktif iş yok</Text>
            <Text style={styles.emptyHint}>
              Çevrimiçi olduğunda yeni teklifler burada ve bildirimde görünür.
            </Text>
            <MiniMapPreview
              centerLat={mapCenter.lat}
              centerLng={mapCenter.lng}
              onOpenMaps={() =>
                Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${mapCenter.lat},${mapCenter.lng}`,
                )
              }
              caption="Bölgen"
            />
            {jobOffers.length > 1 ? (
              <Text style={styles.moreJobs}>
                +{jobOffers.length - 1} bekleyen teklif — İşler sekmesine bak
              </Text>
            ) : null}
          </View>
        ) : null}

        {loadingOrders && orders.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
  default: {},
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 14, paddingBottom: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorPad: { padding: 24 },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorHint: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  focusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 2,
  },
  focusStripTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f766e',
  },
  busyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surfaceTint,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  busyNoticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    lineHeight: 19,
  },
  welcomeBlock: {
    marginBottom: 12,
    marginTop: 2,
  },
  welcomeHi: {
    fontSize: 15,
    color: colors.muted,
    fontWeight: '600',
  },
  welcomeName: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  incomingCard: {
    borderColor: 'rgba(202, 138, 4, 0.35)',
    backgroundColor: '#fffbeb',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleHint: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  switchWrap: { transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }] },
  incomingTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  incomingTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  incomingId: { fontSize: 13, color: colors.muted, fontWeight: '600', marginBottom: 10 },
  incomingStats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLab: { fontSize: 10, color: colors.muted, fontWeight: '700', textTransform: 'uppercase' },
  statVal: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 2 },
  incomingActions: { flexDirection: 'row', gap: 10 },
  emptyHint: { fontSize: 13, color: colors.muted, marginBottom: 10, lineHeight: 18 },
  mapCard: {
    borderRadius: 14,
    overflow: 'hidden',
    height: 140,
    backgroundColor: colors.surfaceTint,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapImage: { width: '100%', height: '100%' },
  mapFallback: { alignItems: 'center', justifyContent: 'center' },
  mapFallbackText: { fontSize: 12, color: colors.muted, marginTop: 8 },
  mapOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  mapCaption: { fontSize: 12, fontWeight: '700', color: colors.text, flex: 1 },
  mapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceTint,
  },
  mapChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  moreJobs: { fontSize: 12, color: colors.primary, fontWeight: '700', marginTop: 10 },
  mtSm: { marginTop: 10 },
  mtXs: { marginTop: 8 },
});
