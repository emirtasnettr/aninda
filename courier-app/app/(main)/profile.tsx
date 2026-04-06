import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { formatApiError } from '../../src/lib/api/error-message';
import { fetchCourierMe, patchCourierMe } from '../../src/lib/api/couriers.api';
import { normalizeIban, isValidTrIban } from '../../src/lib/bank-profile';
import { disconnectRealtimeSocket } from '../../src/lib/socket/realtime';
import { queryClient } from '../../src/lib/queryClient';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';

function shortCourierId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function parseRating(raw: string | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function StarRow({ rating, totalRatings }: { rating: number | null; totalRatings: number }) {
  const full = rating != null ? Math.floor(rating + 0.25) : 0;
  const stars = [1, 2, 3, 4, 5].map((i) => (
    <Ionicons
      key={i}
      name={i <= full ? 'star' : 'star-outline'}
      size={18}
      color={i <= full ? '#ca8a04' : colors.border}
    />
  ));
  return (
    <View style={styles.starRow}>
      {stars}
      <Text style={styles.starMeta}>
        {rating != null ? rating.toFixed(1) : '—'}
        {totalRatings > 0 ? ` · ${totalRatings} değerlendirme` : ''}
      </Text>
    </View>
  );
}

function maskIban(raw: string): string {
  const t = raw.replace(/\s/g, '').toUpperCase();
  if (t.length < 8) return raw || '—';
  return `${t.slice(0, 4)} ······ ······ ${t.slice(-4)}`;
}

function formatAvgMinutes(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n)} dk`;
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.settingsRow, pressed && styles.settingsRowPressed]}
    >
      <View style={styles.settingsIconWrap}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.settingsTextWrap}>
        <Text style={styles.settingsTitle}>{title}</Text>
        {subtitle ? <Text style={styles.settingsSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

function PerfTile({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.perfTile}>
      <Ionicons name={icon} size={20} color={HERO_TEAL} />
      <Text style={styles.perfValue}>{value}</Text>
      <Text style={styles.perfLabel}>{label}</Text>
    </View>
  );
}

const HERO_TEAL = '#0d9488';

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);

  const { data: courier, isLoading } = useQuery({
    queryKey: ['courier', 'me'],
    queryFn: fetchCourierMe,
  });

  const [bankEditing, setBankEditing] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [iban, setIban] = useState('');

  useEffect(() => {
    if (!courier) return;
    setBankName(courier.bankName?.trim() ?? '');
    setAccountHolderName(courier.accountHolderName?.trim() ?? '');
    setIban(courier.iban?.trim() ?? '');
  }, [courier]);

  const saveBank = useMutation({
    mutationFn: () => {
      const ib = normalizeIban(iban);
      if (ib && !isValidTrIban(ib)) {
        throw new Error('IBAN 26 karakter olmalı ve TR ile başlamalıdır.');
      }
      return patchCourierMe({
        bankName: bankName.trim() || undefined,
        accountHolderName: accountHolderName.trim() || undefined,
        iban: ib || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courier', 'me'] });
      setBankEditing(false);
    },
  });

  const toggleOnline = useMutation({
    mutationFn: (isOnline: boolean) => patchCourierMe({ isOnline }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courier', 'me'] });
    },
  });

  const onLogout = async () => {
    disconnectRealtimeSocket();
    queryClient.clear();
    await logout();
    router.replace('/(auth)/login');
  };

  const openAppSettings = () => {
    void Linking.openSettings();
  };

  const comingSoon = (title: string) => {
    Alert.alert(title, 'Bu özellik yakında eklenecek.');
  };

  if (isLoading || !courier) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 1) Header */}
        <View style={styles.headerCard}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person" size={44} color="#fff" />
          </View>
          <Text style={styles.displayName}>
            {courier.fullName?.trim() || courier.user.email.split('@')[0]}
          </Text>
          <View style={styles.idRow}>
            <Ionicons name="id-card-outline" size={14} color={colors.muted} />
            <Text style={styles.idText}>{shortCourierId(courier.id)}</Text>
          </View>
          <StarRow
            rating={parseRating(courier.averageRating ?? null)}
            totalRatings={courier.totalRatings ?? 0}
          />
          <View style={styles.emailRow}>
            <Ionicons name="mail-outline" size={14} color={colors.muted} />
            <Text style={styles.emailText}>{courier.user.email}</Text>
          </View>
        </View>

        {/* 2) Durum */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Durum</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: courier.isOnline ? colors.success : colors.muted },
                ]}
              />
              <View>
                <Text style={styles.statusLabel}>
                  {courier.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                </Text>
                <Text style={styles.statusHint}>
                  {courier.isOnline
                    ? 'Yeni iş teklifleri alabilirsiniz'
                    : 'İş almak için çevrimiçi olun'}
                </Text>
              </View>
            </View>
            <Switch
              value={courier.isOnline}
              onValueChange={(v) => toggleOnline.mutate(v)}
              disabled={toggleOnline.isPending}
              trackColor={{ false: colors.border, true: '#a7f3d0' }}
              thumbColor={courier.isOnline ? colors.success : '#f4f4f5'}
            />
          </View>
          <View style={styles.badgeRow}>
            <Text style={styles.badgeLbl}>Araç</Text>
            <View style={styles.vehicleBadge}>
              <Ionicons
                name={courier.type === 'MOTORCYCLE' ? 'bicycle' : 'car-outline'}
                size={16}
                color="#1e40af"
              />
              <Text style={styles.vehicleBadgeText}>
                {courier.type === 'MOTORCYCLE' ? 'Motosiklet' : 'Otomobil'}
              </Text>
            </View>
          </View>
        </View>

        {/* 3) Performans */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Performans</Text>
          <Text style={styles.cardSub}>
            Müşteri geri bildirimleri ve teslimat geçmişinize göre
          </Text>
          <View style={styles.perfRow}>
            <PerfTile
              icon="cube-outline"
              value={String(courier.performance?.successfulDeliveries ?? 0)}
              label="Teslimat"
            />
            <PerfTile
              icon="star-half-outline"
              value={
                parseRating(courier.averageRating ?? null) != null
                  ? parseRating(courier.averageRating ?? null)!.toFixed(1)
                  : '—'
              }
              label="Ort. puan"
            />
            <PerfTile
              icon="timer-outline"
              value={formatAvgMinutes(
                courier.performance?.averageDeliveryTimeMinutes ?? null,
              )}
              label="Ort. süre"
            />
          </View>
        </View>

        {/* 4) Banka */}
        <View style={styles.card}>
          <View style={styles.bankHead}>
            <View>
              <Text style={styles.cardTitle}>Banka bilgileri</Text>
              <Text style={styles.cardSub}>
                Ödeme talepleri bu hesaba yapılır
              </Text>
            </View>
            {!bankEditing ? (
              <Pressable
                onPress={() => setBankEditing(true)}
                style={({ pressed }) => [styles.editPill, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="pencil" size={14} color={HERO_TEAL} />
                <Text style={styles.editPillText}>Düzenle</Text>
              </Pressable>
            ) : null}
          </View>

          {!bankEditing ? (
            <View style={styles.bankReadonly}>
              <BankReadRow icon="business-outline" label="Banka" value={courier.bankName?.trim() || '—'} />
              <BankReadRow
                icon="person-outline"
                label="Hesap sahibi"
                value={courier.accountHolderName?.trim() || '—'}
              />
              <BankReadRow
                icon="card-outline"
                label="IBAN"
                value={courier.iban?.trim() ? maskIban(courier.iban) : '—'}
              />
            </View>
          ) : (
            <>
              <Text style={styles.inputLabel}>Banka adı</Text>
              <TextInput
                style={styles.input}
                value={bankName}
                onChangeText={setBankName}
                placeholder="Örn. Ziraat Bankası"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
              />
              <Text style={[styles.inputLabel, styles.inputLabelMt]}>Hesap sahibi</Text>
              <TextInput
                style={styles.input}
                value={accountHolderName}
                onChangeText={setAccountHolderName}
                placeholder="Ad soyad (IBAN ile uyumlu)"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
              />
              <Text style={[styles.inputLabel, styles.inputLabelMt]}>IBAN</Text>
              <TextInput
                style={styles.input}
                value={iban}
                onChangeText={setIban}
                placeholder="TR00 … (26 karakter)"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
              />
              {saveBank.isError ? (
                <Text style={styles.error}>{formatApiError(saveBank.error)}</Text>
              ) : null}
              <View style={styles.bankActions}>
                <Pressable
                  onPress={() => {
                    setBankEditing(false);
                    setBankName(courier.bankName?.trim() ?? '');
                    setAccountHolderName(courier.accountHolderName?.trim() ?? '');
                    setIban(courier.iban?.trim() ?? '');
                  }}
                  style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.btnGhostText}>İptal</Text>
                </Pressable>
                <PrimaryButton
                  title={saveBank.isPending ? 'Kaydediliyor…' : 'Kaydet'}
                  onPress={() => saveBank.mutate()}
                  loading={saveBank.isPending}
                  style={styles.btnSaveFlex}
                />
              </View>
            </>
          )}
        </View>

        {/* 5) Güven */}
        <View style={styles.trustBanner}>
          <Ionicons name="shield-checkmark" size={22} color={HERO_TEAL} />
          <View style={styles.trustTextWrap}>
            <Text style={styles.trustTitle}>Bilgileriniz güvenle saklanır</Text>
            <Text style={styles.trustSub}>
              Banka ve kimlik verileriniz şifreli bağlantı ile iletilir; yalnızca ödeme
              işlemleri için kullanılır.
            </Text>
          </View>
        </View>

        {/* 6) Ayarlar */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ayarlar</Text>
          <SettingsRow
            icon="key-outline"
            title="Şifre değiştir"
            subtitle="Hesap güvenliğinizi güncelleyin"
            onPress={() => comingSoon('Şifre değiştir')}
          />
          <View style={styles.settingsSep} />
          <SettingsRow
            icon="notifications-outline"
            title="Bildirim ayarları"
            subtitle="Sistem bildirimlerini aç veya kapat"
            onPress={openAppSettings}
          />
        </View>

        {/* 7) Çıkış */}
        <Pressable
          onPress={() =>
            Alert.alert('Çıkış yap', 'Oturumunuz kapatılacak.', [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Çıkış yap', style: 'destructive', onPress: () => void onLogout() },
            ])
          }
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.92 }]}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          <Text style={styles.logoutText}>Çıkış yap</Text>
        </Pressable>

        <Text style={styles.footerVer}>Teslimatjet Kurye</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function BankReadRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.bankReadRow}>
      <Ionicons name={icon} size={18} color={colors.muted} />
      <View style={styles.bankReadText}>
        <Text style={styles.bankReadLbl}>{label}</Text>
        <Text style={styles.bankReadVal}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 36 },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: HERO_TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  idText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 10,
    justifyContent: 'center',
  },
  starMeta: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  emailText: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 18,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 16, fontWeight: '800', color: colors.text },
  statusHint: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: '500' },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  badgeLbl: { fontSize: 13, fontWeight: '700', color: colors.muted },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  vehicleBadgeText: { fontSize: 14, fontWeight: '800', color: '#1e40af' },
  perfRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  perfTile: {
    flex: 1,
    backgroundColor: colors.surfaceTint,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  perfValue: { fontSize: 18, fontWeight: '900', color: colors.text },
  perfLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    textAlign: 'center',
  },
  bankHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editPillText: { fontSize: 13, fontWeight: '800', color: HERO_TEAL },
  bankReadonly: { marginTop: 14, gap: 14 },
  bankReadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bankReadText: { flex: 1, minWidth: 0 },
  bankReadLbl: { fontSize: 11, fontWeight: '800', color: colors.muted },
  bankReadVal: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: 4 },
  inputLabelMt: { marginTop: 14 },
  input: {
    marginTop: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  bankActions: { flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'center' },
  btnGhost: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
  },
  btnGhostText: { fontSize: 15, fontWeight: '700', color: colors.muted },
  btnSaveFlex: { flex: 1, marginTop: 0 },
  trustBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  trustTextWrap: { flex: 1 },
  trustTitle: { fontSize: 14, fontWeight: '800', color: '#065f46' },
  trustSub: {
    fontSize: 12,
    color: '#047857',
    marginTop: 4,
    lineHeight: 17,
    fontWeight: '500',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  settingsRowPressed: { opacity: 0.75 },
  settingsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTextWrap: { flex: 1, minWidth: 0 },
  settingsTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  settingsSub: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: '500' },
  settingsSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  logoutText: { fontSize: 16, fontWeight: '800', color: colors.danger },
  footerVer: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.muted,
    marginTop: 20,
    fontWeight: '600',
  },
});
