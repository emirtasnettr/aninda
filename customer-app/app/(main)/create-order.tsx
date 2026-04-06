import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { fetchMyPricingQuote } from '../../src/lib/api/pricing.api';
import { createOrder } from '../../src/lib/api/orders.api';
import { useOrderDraftStore } from '../../src/store/orderDraftStore';
import { colors } from '../../src/theme/colors';

function fmtCoord(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return 'Seçilmedi';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function CreateOrderScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pickupLat = useOrderDraftStore((s) => s.pickupLat);
  const pickupLng = useOrderDraftStore((s) => s.pickupLng);
  const deliveryLat = useOrderDraftStore((s) => s.deliveryLat);
  const deliveryLng = useOrderDraftStore((s) => s.deliveryLng);
  const resetDraft = useOrderDraftStore((s) => s.reset);
  const [priority, setPriority] = useState(false);

  const coordsReady =
    pickupLat != null &&
    pickupLng != null &&
    deliveryLat != null &&
    deliveryLng != null;

  const quoteQuery = useQuery({
    queryKey: [
      'me-quote',
      pickupLat,
      pickupLng,
      deliveryLat,
      deliveryLng,
      priority,
    ],
    queryFn: () =>
      fetchMyPricingQuote({
        pickupLat: pickupLat!,
        pickupLng: pickupLng!,
        deliveryLat: deliveryLat!,
        deliveryLng: deliveryLng!,
        priority,
      }),
    enabled: coordsReady,
  });

  const ready =
    coordsReady && quoteQuery.isSuccess && quoteQuery.data != null;

  const mutation = useMutation({
    mutationFn: () =>
      createOrder({
        pickupLat: pickupLat!,
        pickupLng: pickupLng!,
        deliveryLat: deliveryLat!,
        deliveryLng: deliveryLng!,
        price: quoteQuery.data!.total,
        priority,
      }),
    onSuccess: (order) => {
      resetDraft();
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      router.replace(`/(main)/tracking/${order.id}`);
    },
    onError: (error: unknown) => {
      let msg = 'Sipariş oluşturulamadı. Bağlantınızı kontrol edin.';
      if (axios.isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
        const m = (error.response.data as { message?: string | string[] }).message;
        if (typeof m === 'string') msg = m;
        else if (Array.isArray(m)) msg = m.join(', ');
      }
      Alert.alert('Hata', msg);
    },
  });

  const q = quoteQuery.data;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>Alış adresi (harita)</Text>
        <TouchableOpacity
          style={styles.pickRow}
          onPress={() =>
            router.push({ pathname: '/(main)/map-selection', params: { field: 'pickup' } })
          }
        >
          <Text style={styles.pickLabel}>Koordinat</Text>
          <Text style={styles.pickValue}>{fmtCoord(pickupLat, pickupLng)}</Text>
          <Text style={styles.pickAction}>Seç ›</Text>
        </TouchableOpacity>

        <Text style={[styles.section, styles.mt]}>Teslimat adresi (harita)</Text>
        <TouchableOpacity
          style={styles.pickRow}
          onPress={() =>
            router.push({ pathname: '/(main)/map-selection', params: { field: 'delivery' } })
          }
        >
          <Text style={styles.pickLabel}>Koordinat</Text>
          <Text style={styles.pickValue}>{fmtCoord(deliveryLat, deliveryLng)}</Text>
          <Text style={styles.pickAction}>Seç ›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.priorityRow}
          onPress={() => setPriority((p) => !p)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, priority && styles.checkboxOn]} />
          <Text style={styles.priorityLabel}>Öncelikli sipariş</Text>
        </TouchableOpacity>

        <View style={styles.priceBox}>
          <Text style={styles.priceTitle}>Fiyat (sunucu)</Text>
          {!coordsReady ? (
            <Text style={styles.muted}>Her iki noktayı seçince tutar hesaplanır</Text>
          ) : quoteQuery.isPending ? (
            <Text style={styles.muted}>Hesaplanıyor…</Text>
          ) : quoteQuery.isError ? (
            <Text style={styles.err}>Fiyat alınamadı. Ağı kontrol edin.</Text>
          ) : q ? (
            <>
              <Text style={styles.priceLine}>Mesafe: ~{q.km} km</Text>
              {q.isNight ? (
                <Text style={styles.priceHint}>
                  Gece (İstanbul): {q.nightApplied ? 'gece çarpanı uygulandı' : 'çarpan yok'}
                </Text>
              ) : null}
              <Text style={styles.priceTotal}>{q.total} ₺</Text>
              <Text style={styles.priceHint}>
                Tarifeniz ve anlık çarpanlarla sunucuda hesaplanır.
              </Text>
            </>
          ) : null}
        </View>

        <PrimaryButton
          title="Siparişi oluştur"
          loading={mutation.isPending}
          disabled={!ready}
          onPress={() => mutation.mutate()}
        />

        <PrimaryButton
          title="Taslağı sıfırla"
          variant="outline"
          onPress={() => resetDraft()}
          style={styles.mtBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  section: { fontSize: 15, fontWeight: '700', color: colors.text },
  mt: { marginTop: 20 },
  pickRow: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  pickValue: { fontSize: 15, color: colors.text, marginTop: 6 },
  pickAction: {
    position: 'absolute',
    right: 16,
    top: 22,
    color: colors.primary,
    fontWeight: '700',
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  checkboxOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  priorityLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  priceBox: {
    marginTop: 24,
    marginBottom: 20,
    padding: 18,
    backgroundColor: colors.surfaceTint,
    borderRadius: 14,
  },
  priceTitle: { fontSize: 16, fontWeight: '800', color: colors.primaryDark },
  priceLine: { fontSize: 14, color: colors.text, marginTop: 8 },
  priceTotal: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primaryDark,
    marginTop: 6,
  },
  priceHint: { fontSize: 12, color: colors.muted, marginTop: 8 },
  muted: { fontSize: 14, color: colors.muted, marginTop: 8 },
  err: { fontSize: 14, color: '#b91c1c', marginTop: 8 },
  mtBtn: { marginTop: 12 },
});
