import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchOrders, rateCourierForOrder } from '../../src/lib/api/orders.api';
import type { Order } from '../../src/lib/api/types';
import { colors } from '../../src/theme/colors';

function InlineRateCourier({
  orderId,
  onDone,
}: {
  orderId: string;
  onDone: () => void;
}) {
  const [picked, setPicked] = useState(0);
  const mut = useMutation({
    mutationFn: (rating: number) => rateCourierForOrder(orderId, { rating }),
    onSuccess: () => {
      Alert.alert('Teşekkürler', 'Puanınız kaydedildi.');
      onDone();
    },
    onError: () => {
      Alert.alert('Hata', 'Puan gönderilemedi. Tekrar deneyin.');
    },
  });

  return (
    <View style={styles.rateBox}>
      <Text style={styles.rateLabel}>Kuryeyi puanlayın</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            disabled={mut.isPending}
            onPress={() => {
              setPicked(n);
              mut.mutate(n);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Ionicons
              name={n <= picked ? 'star' : 'star-outline'}
              size={26}
              color={n <= picked ? '#d97706' : colors.muted}
            />
          </TouchableOpacity>
        ))}
      </View>
      {mut.isPending ? (
        <Text style={styles.rateSending}>Gönderiliyor…</Text>
      ) : null}
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function OrderHistoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });

  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const renderItem = ({ item }: { item: Order }) => (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() => router.push(`/(main)/tracking/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.row}>
          <Text style={styles.orderId}>#{item.id.slice(0, 8)}…</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
        <Text style={styles.price}>{item.price} ₺</Text>
        <Text style={styles.trackHint}>Takip için dokunun ›</Text>
      </TouchableOpacity>
      {item.status === 'DELIVERED' &&
      item.courierId &&
      !item.courierRating ? (
        <InlineRateCourier
          orderId={item.id}
          onDone={() =>
            void queryClient.invalidateQueries({ queryKey: ['orders'] })
          }
        />
      ) : item.status === 'DELIVERED' && item.courierRating ? (
        <Text style={styles.ratedNote}>Puanınız kayıtlı</Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Henüz sipariş yok. Yeni gönderi oluşturun.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderId: { fontSize: 16, fontWeight: '800', color: colors.text },
  statusPill: {
    backgroundColor: colors.surfaceTint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 12, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 8 },
  price: { fontSize: 18, fontWeight: '800', color: colors.primaryDark, marginTop: 6 },
  trackHint: { fontSize: 13, color: colors.primary, marginTop: 10, fontWeight: '600' },
  rateBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rateLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
  starsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  rateSending: { fontSize: 12, color: colors.muted, marginTop: 6 },
  ratedNote: { fontSize: 12, color: colors.muted, marginTop: 10, fontStyle: 'italic' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 48, fontSize: 16 },
});
