import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useOrderDraftStore } from '../../src/store/orderDraftStore';
import { colors } from '../../src/theme/colors';

const DEFAULT = { latitude: 41.0082, longitude: 28.9784 };

export default function MapSelectionScreen() {
  const router = useRouter();
  const { field } = useLocalSearchParams<{ field: string }>();
  const setPickup = useOrderDraftStore((s) => s.setPickup);
  const setDelivery = useOrderDraftStore((s) => s.setDelivery);
  const draftPickupLat = useOrderDraftStore((s) => s.pickupLat);
  const draftPickupLng = useOrderDraftStore((s) => s.pickupLng);
  const draftDeliveryLat = useOrderDraftStore((s) => s.deliveryLat);
  const draftDeliveryLng = useOrderDraftStore((s) => s.deliveryLng);

  const mode = field === 'delivery' ? 'delivery' : 'pickup';

  const initial =
    mode === 'pickup'
      ? draftPickupLat != null && draftPickupLng != null
        ? { latitude: draftPickupLat, longitude: draftPickupLng }
        : DEFAULT
      : draftDeliveryLat != null && draftDeliveryLng != null
        ? { latitude: draftDeliveryLat, longitude: draftDeliveryLng }
        : DEFAULT;

  const [coord, setCoord] = useState(initial);
  const [region, setRegion] = useState<Region>({
    ...initial,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [locLoading, setLocLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          setLocLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        const next = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setCoord(next);
        setRegion((r) => ({
          ...r,
          latitude: next.latitude,
          longitude: next.longitude,
        }));
      } catch {
        /* varsayılan İstanbul */
      } finally {
        if (!cancelled) setLocLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onConfirm = useCallback(() => {
    if (mode === 'pickup') {
      setPickup(coord.latitude, coord.longitude);
    } else {
      setDelivery(coord.latitude, coord.longitude);
    }
    router.back();
  }, [coord, mode, router, setDelivery, setPickup]);

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.fallback}>
        <Text style={styles.fallbackText}>
          Harita seçimi şu an iOS ve Android uygulamasında desteklenir. Web için koordinatları
          manuel girebilir veya mobil cihazda deneyin.
        </Text>
        <PrimaryButton title="Geri" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {locLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        onPress={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          setCoord({ latitude, longitude });
        }}
      >
        <Marker
          coordinate={coord}
          draggable
          onDragEnd={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            setCoord({ latitude, longitude });
          }}
        />
      </MapView>
      <View style={styles.footer}>
        <Text style={styles.hint}>
          {mode === 'pickup' ? 'Alış' : 'Teslimat'}: {coord.latitude.toFixed(5)},{' '}
          {coord.longitude.toFixed(5)}
        </Text>
        <PrimaryButton title="Bu konumu kullan" onPress={onConfirm} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  footer: {
    padding: 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  hint: { fontSize: 13, color: colors.muted, marginBottom: 12 },
  fallback: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  fallbackText: { fontSize: 16, color: colors.text, marginBottom: 24, lineHeight: 24 },
});
