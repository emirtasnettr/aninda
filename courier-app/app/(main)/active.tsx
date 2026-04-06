import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActiveDeliveryFocusCard,
  isActiveDeliveryStatus,
} from '../../src/components/ActiveDeliveryFocusCard';
import { fetchCourierMe } from '../../src/lib/api/couriers.api';
import { fetchOrders } from '../../src/lib/api/orders.api';
import { colors } from '../../src/theme/colors';

export default function ActiveJobsScreen() {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);

  const { data: courier, isLoading: loadingCourier, refetch: refetchCourier } =
    useQuery({
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
    const ms = activeOrder ? 10_000 : 60_000;
    const i = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(i);
  }, [activeOrder]);

  const onRefresh = () => {
    setRefreshing(true);
    void Promise.all([refetchCourier(), refetchOrders()]).finally(() =>
      setRefreshing(false),
    );
  };

  if (loadingCourier || !courier) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Aktif işlerim</Text>
        <Text style={styles.screenSub}>
          Şu an üzerinde olduğun teslimat — geri kalan her şey ikinci planda.
        </Text>

        {loadingOrders && orders.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : activeOrder ? (
          <ActiveDeliveryFocusCard
            order={activeOrder}
            courierLat={courier.lat}
            courierLng={courier.lng}
            nowMs={now}
            onOpenDeliveryScreen={() =>
              router.push(`/(main)/delivery/${activeOrder.id}`)
            }
          />
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyTitle}>Aktif teslimat yok</Text>
            <Text style={styles.emptyBody}>
              Yeni iş için Ana sayfa veya İşler sekmesine bak. Çevrimiçi olduğunda
              teklifler gelir.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingBottom: 28 },
  screenTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  screenSub: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 14,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 21,
  },
});
