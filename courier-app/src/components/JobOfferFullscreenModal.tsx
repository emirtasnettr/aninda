import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  acceptOrder,
  declineOrderOffer,
} from '../lib/api/orders.api';
import { estRouteMinutes, haversineKm } from '../lib/geo/haversineKm';
import { queryClient } from '../lib/queryClient';
import { playJobAlertFeedback } from '../lib/sounds/playJobAlert';
import { useJobOfferOverlayStore } from '../store/jobOfferOverlayStore';
import { colors } from '../theme/colors';

const COUNTDOWN_SEC = 10;

function formatCoord(lat: number, lng: number): string {
  return `${lat.toFixed(4)} · ${lng.toFixed(4)}`;
}

export function JobOfferFullscreenModal() {
  const router = useRouter();
  const activeOffer = useJobOfferOverlayStore((s) => s.activeOffer);
  const dismiss = useJobOfferOverlayStore((s) => s.dismiss);

  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SEC);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const handledRef = useRef(false);
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const visible = activeOffer != null;
  const orderId = activeOffer?.orderId;

  const offerRef = useRef(activeOffer);
  offerRef.current = activeOffer;

  const runDecline = useCallback(async () => {
    const o = offerRef.current;
    if (!o || handledRef.current) return;
    handledRef.current = true;
    try {
      await declineOrderOffer(o.orderId);
    } catch {
      /* süre doldu / teklif yok — yine de kapat */
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      dismiss();
    }
  }, [dismiss]);

  const runAccept = useCallback(async () => {
    const o = offerRef.current;
    if (!o || handledRef.current) return;
    handledRef.current = true;
    setAccepting(true);
    try {
      const order = await acceptOrder(o.orderId);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['courier', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['earnings', 'summary'] });
      dismiss();
      router.replace(`/(main)/delivery/${order.id}`);
    } catch {
      handledRef.current = false;
      setAccepting(false);
    }
  }, [dismiss, router]);

  useEffect(() => {
    if (!visible || !orderId) {
      return;
    }
    handledRef.current = false;
    setSecondsLeft(COUNTDOWN_SEC);
    setAccepting(false);
    setDeclining(false);
    void playJobAlertFeedback();

    scale.setValue(0.92);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    let s = COUNTDOWN_SEC;
    const id = setInterval(() => {
      s -= 1;
      setSecondsLeft(s);
      if (s <= 0) {
        clearInterval(id);
        void runDecline();
      }
    }, 1000);

    return () => clearInterval(id);
  }, [visible, orderId, runDecline, opacity, scale]);

  const routeKm = activeOffer
    ? haversineKm(
        activeOffer.pickupLat,
        activeOffer.pickupLng,
        activeOffer.deliveryLat,
        activeOffer.deliveryLng,
      )
    : 0;
  const estMin = estRouteMinutes(routeKm);

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => {
        /* sistem geri — reddet gibi */
        if (!handledRef.current) {
          setDeclining(true);
          void runDecline();
        }
      }}
    >
      {activeOffer ? (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <Animated.View
            style={[
              styles.sheet,
              {
                opacity,
                transform: [{ scale }],
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Yeni iş teklifi</Text>
              <View style={styles.timerWrap}>
                <Text
                  style={[
                    styles.timer,
                    secondsLeft <= 3 && styles.timerUrgent,
                  ]}
                >
                  {secondsLeft}
                </Text>
                <Text style={styles.timerLabel}>sn</Text>
              </View>
            </View>

            <View style={styles.hero}>
              <Text style={styles.priceLabel}>Kazanç (sipariş)</Text>
              <Text style={styles.price}>{activeOffer.price} ₺</Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLab}>Mesafe</Text>
                  <Text style={styles.statVal}>{routeKm.toFixed(1)} km</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statLab}>Tahmini süre</Text>
                  <Text style={styles.statVal}>~{estMin} dk</Text>
                </View>
              </View>
            </View>

            <View style={styles.addrBlock}>
              <Text style={styles.addrTitle}>Alış</Text>
              <Text style={styles.addrText} numberOfLines={2}>
                {formatCoord(activeOffer.pickupLat, activeOffer.pickupLng)}
              </Text>
              <Text style={[styles.addrTitle, styles.addrTitleMt]}>Teslim</Text>
              <Text style={styles.addrText} numberOfLines={2}>
                {formatCoord(activeOffer.deliveryLat, activeOffer.deliveryLng)}
              </Text>
            </View>

            <View style={styles.footer}>
              <Pressable
                style={({ pressed }) => [
                  styles.btnAccept,
                  pressed && styles.btnPressed,
                  (accepting || declining) && styles.btnDisabled,
                ]}
                onPress={() => void runAccept()}
                disabled={accepting || declining}
              >
                {accepting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnAcceptText}>Kabul et</Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.btnDecline,
                  pressed && styles.btnPressed,
                  (accepting || declining) && styles.btnDisabled,
                ]}
                onPress={() => {
                  if (handledRef.current) return;
                  setDeclining(true);
                  void runDecline();
                }}
                disabled={accepting || declining}
              >
                {declining && !accepting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnDeclineText}>Reddet</Text>
                )}
              </Pressable>
            </View>

            <Text style={styles.hint}>
              Süre dolunca teklif otomatik reddedilir.
            </Text>
          </Animated.View>
        </SafeAreaView>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  sheet: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fafafa',
    letterSpacing: -0.3,
  },
  timerWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 4,
  },
  timer: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fafafa',
    fontVariant: ['tabular-nums'],
  },
  timerUrgent: {
    color: '#fca5a5',
  },
  timerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(250,250,250,0.7)',
  },
  hero: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(250,250,250,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  price: {
    fontSize: 44,
    fontWeight: '900',
    color: '#4ade80',
    marginTop: 6,
    letterSpacing: -1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  stat: { flex: 1 },
  statLab: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(250,250,250,0.5)',
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fafafa',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 14,
  },
  addrBlock: {
    flex: 1,
    minHeight: 0,
    marginBottom: 12,
  },
  addrTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(250,250,250,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  addrTitleMt: { marginTop: 14 },
  addrText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e4e4e7',
    marginTop: 6,
    lineHeight: 22,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  footer: {
    gap: 12,
    paddingBottom: 6,
  },
  btnAccept: {
    backgroundColor: '#16a34a',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  btnDecline: {
    backgroundColor: colors.danger,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  btnDisabled: { opacity: 0.55 },
  btnAcceptText: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  btnDeclineText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(250,250,250,0.45)',
    marginTop: 10,
    marginBottom: 4,
  },
});
