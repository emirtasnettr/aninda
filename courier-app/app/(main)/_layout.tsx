import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fetchCourierMe } from '../../src/lib/api/couriers.api';
import { fetchOrders } from '../../src/lib/api/orders.api';
import type { JobRequestPayload } from '../../src/lib/api/types';
import { isCourierBusyWithActiveOrders } from '../../src/lib/courier-active-delivery';
import {
  setupCourierJobNotifications,
  showCourierJobNotification,
} from '../../src/lib/notifications/courierJobNotification';
import { queryClient } from '../../src/lib/queryClient';
import {
  connectRealtimeSocket,
  disconnectRealtimeSocket,
  WS_SERVER_EVENTS,
} from '../../src/lib/socket/realtime';
import { CourierDocumentsFlow } from '../../src/components/CourierDocumentsFlow';
import { CourierInAppNoticeBanner } from '../../src/components/CourierInAppNoticeBanner';
import { JobOfferFullscreenModal } from '../../src/components/JobOfferFullscreenModal';
import { useAuthStore } from '../../src/store/authStore';
import { useCourierInAppNoticeStore } from '../../src/store/courierInAppNoticeStore';
import { useJobOfferOverlayStore } from '../../src/store/jobOfferOverlayStore';
import { colors } from '../../src/theme/colors';

function jobBody(p: JobRequestPayload): string {
  const short = p.orderId.slice(0, 8);
  return `Sipariş #${short} · ${p.price} ₺`;
}

function ApprovedCourierShell() {
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!token) {
      return;
    }
    void setupCourierJobNotifications();
    const sock = connectRealtimeSocket(token);
    const onJobRequest = (p: JobRequestPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void (async () => {
        try {
          const courier = await queryClient.fetchQuery({
            queryKey: ['courier', 'me'],
            queryFn: fetchCourierMe,
          });
          const orders = await queryClient.fetchQuery({
            queryKey: ['orders'],
            queryFn: fetchOrders,
          });
          if (isCourierBusyWithActiveOrders(orders, courier.id)) {
            return;
          }
        } catch {
          return;
        }
        if (AppState.currentState === 'active') {
          useJobOfferOverlayStore.getState().show(p);
          return;
        }
        const ok = await showCourierJobNotification({
          title: 'Yeni iş teklifi',
          body: jobBody(p),
        });
        if (!ok) {
          useCourierInAppNoticeStore.getState().enqueue({
            title: 'Yeni iş teklifi',
            body: jobBody(p),
            orderId: p.orderId,
          });
        }
      })();
    };
    const onOrderAssigned = (p: JobRequestPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void (async () => {
        const ok = await showCourierJobNotification({
          title: 'Sipariş size atandı',
          body: jobBody(p),
        });
        const fg = AppState.currentState === 'active';
        if (!ok || fg) {
          useCourierInAppNoticeStore.getState().enqueue({
            title: 'Sipariş size atandı',
            body: jobBody(p),
            orderId: p.orderId,
          });
        }
      })();
    };
    sock.on(WS_SERVER_EVENTS.JOB_REQUEST, onJobRequest);
    sock.on(WS_SERVER_EVENTS.ORDER_ASSIGNED, onOrderAssigned);
    return () => {
      sock.off(WS_SERVER_EVENTS.JOB_REQUEST, onJobRequest);
      sock.off(WS_SERVER_EVENTS.ORDER_ASSIGNED, onOrderAssigned);
      disconnectRealtimeSocket();
    };
  }, [token]);

  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);
  const tabBarHeight = 52 + bottomPad;

  return (
    <View style={styles.root}>
      <CourierInAppNoticeBanner />
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.card,
          },
          headerShadowVisible: false,
          headerTintColor: colors.primary,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 18,
            color: colors.text,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            paddingTop: 6,
            paddingBottom: bottomPad,
            height: tabBarHeight,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowOffset: { width: 0, height: -2 },
            shadowRadius: 8,
            elevation: 12,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: -2,
          },
          tabBarItemStyle: { paddingTop: 4 },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Ana sayfa',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="active"
          options={{
            title: 'Aktif işlerim',
            tabBarLabel: 'Aktif',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="navigate-circle-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="jobs"
          options={{
            title: 'İşler',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="briefcase-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="earnings"
          options={{
            title: 'Kazanç',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="wallet-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="delivery/[orderId]"
          options={{
            href: null,
            title: 'Teslimat',
          }}
        />
      </Tabs>
      <JobOfferFullscreenModal />
    </View>
  );
}

function CourierApprovalGate() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const q = useQuery({
    queryKey: ['courier', 'me'],
    queryFn: fetchCourierMe,
    staleTime: 30_000,
    retry: 1,
  });

  if (q.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.gateSub}>Profil yükleniyor…</Text>
      </View>
    );
  }

  if (q.isError) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.muted} />
        <Text style={styles.gateTitle}>Bağlantı hatası</Text>
        <Text style={styles.gateSub}>Profil bilgisi alınamadı.</Text>
        <Pressable style={styles.gateBtn} onPress={() => q.refetch()}>
          <Text style={styles.gateBtnText}>Tekrar dene</Text>
        </Pressable>
        <Pressable
          style={[styles.gateBtn, styles.gateBtnOutline]}
          onPress={async () => {
            await logout();
            router.replace('/(auth)/login');
          }}
        >
          <Text style={[styles.gateBtnText, styles.gateBtnTextOutline]}>Çıkış</Text>
        </Pressable>
      </View>
    );
  }

  const profile = q.data;
  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.gateSub}>Profil yükleniyor…</Text>
      </View>
    );
  }

  const ws = profile.workflowStatus;
  if (ws === 'PENDING') {
    return (
      <View style={styles.center}>
        <Ionicons name="time-outline" size={56} color={colors.primary} />
        <Text style={styles.gateTitle}>Başvurunuz inceleniyor</Text>
        <Text style={styles.gateBody}>
          Ekibimiz bilgilerinizi kontrol ediyor. En kısa sürede e-posta ile
          bilgilendirileceksiniz. Bu ekrandan çıkmak için çıkış yapabilirsiniz.
        </Text>
        <Pressable
          style={styles.gateBtn}
          onPress={() => void q.refetch()}
        >
          <Text style={styles.gateBtnText}>Durumu yenile</Text>
        </Pressable>
        <Pressable
          style={[styles.gateBtn, styles.gateBtnOutline]}
          onPress={async () => {
            await logout();
            router.replace('/(auth)/login');
          }}
        >
          <Text style={[styles.gateBtnText, styles.gateBtnTextOutline]}>Çıkış yap</Text>
        </Pressable>
      </View>
    );
  }

  if (ws === 'REJECTED') {
    return (
      <View style={styles.center}>
        <Ionicons name="close-circle-outline" size={56} color={colors.danger} />
        <Text style={styles.gateTitle}>Başvurunuz reddedildi</Text>
        <Text style={styles.gateBody}>
          {profile.rejectionReason?.trim()
            ? profile.rejectionReason
            : 'Şu an hesabınızla iş alamazsınız. Destek için operasyon ekibiyle iletişime geçin.'}
        </Text>
        <Pressable
          style={[styles.gateBtn, styles.gateBtnOutline]}
          onPress={async () => {
            await logout();
            router.replace('/(auth)/login');
          }}
        >
          <Text style={[styles.gateBtnText, styles.gateBtnTextOutline]}>Çıkış yap</Text>
        </Pressable>
      </View>
    );
  }

  if (ws === 'PRE_APPROVED' || ws === 'DOCUMENT_PENDING') {
    return (
      <CourierDocumentsFlow
        profile={profile}
        refreshing={q.isFetching}
        onRefresh={() => void q.refetch()}
        onLogout={async () => {
          await logout();
          router.replace('/(auth)/login');
        }}
      />
    );
  }

  if (ws === 'DOCUMENT_REVIEW') {
    return (
      <View style={styles.center}>
        <Ionicons name="hourglass-outline" size={56} color={colors.primary} />
        <Text style={styles.gateTitle}>Evraklarınız inceleniyor</Text>
        <Text style={styles.gateBody}>
          Yüklediğiniz evraklar operasyon ekibi tarafından kontrol ediliyor.
          Kısa süre içinde sonuç bildirilecektir. Reddedilen bir evrak olursa
          yalnızca o belgeyi yeniden yüklemeniz istenir.
        </Text>
        <Pressable style={styles.gateBtn} onPress={() => void q.refetch()}>
          <Text style={styles.gateBtnText}>Durumu yenile</Text>
        </Pressable>
        <Pressable
          style={[styles.gateBtn, styles.gateBtnOutline]}
          onPress={async () => {
            await logout();
            router.replace('/(auth)/login');
          }}
        >
          <Text style={[styles.gateBtnText, styles.gateBtnTextOutline]}>Çıkış yap</Text>
        </Pressable>
      </View>
    );
  }

  if (ws === 'APPROVED') {
    return <ApprovedCourierShell />;
  }

  return (
    <View style={styles.center}>
      <Text style={styles.gateTitle}>Hesap durumu</Text>
      <Text style={styles.gateBody}>
        Beklenmeyen bir durum oluştu ({ws}). Lütfen çıkış yapıp tekrar deneyin
        veya destek ile iletişime geçin.
      </Text>
      <Pressable
        style={[styles.gateBtn, styles.gateBtnOutline]}
        onPress={async () => {
          await logout();
          router.replace('/(auth)/login');
        }}
      >
        <Text style={[styles.gateBtnText, styles.gateBtnTextOutline]}>Çıkış yap</Text>
      </Pressable>
    </View>
  );
}

export default function MainLayout() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  return <CourierApprovalGate />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 28,
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginTop: 16,
  },
  gateSub: {
    marginTop: 10,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  gateBody: {
    marginTop: 12,
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  gateBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  gateBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    marginTop: 12,
  },
  gateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  gateBtnTextOutline: {
    color: colors.primary,
  },
});
