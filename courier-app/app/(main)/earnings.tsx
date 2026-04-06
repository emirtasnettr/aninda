import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import {
  fetchEarningsSummary,
  fetchMyEarnings,
  type MyCourierEarning,
} from '../../src/lib/api/earnings.api';
import { formatApiError } from '../../src/lib/api/error-message';
import { fetchCourierMe } from '../../src/lib/api/couriers.api';
import {
  createPayoutRequest,
  fetchMyPayoutRequests,
  type MyPayoutRequest,
} from '../../src/lib/api/payouts.api';
import { hasCompleteBankProfile } from '../../src/lib/bank-profile';
import { colors } from '../../src/theme/colors';

const HERO_ACCENT = '#0d9488';
const HERO_ACCENT_DARK = '#0f766e';

function parseNum(s: string | undefined): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatTry(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return `${s} ₺`;
  return `${n.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

function formatTryCompact(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return `${n.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} ₺`;
}

function formatDateOnly(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function shortOrderId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 8)}…`;
}

function earningStatusLabel(st: MyCourierEarning['status']): string {
  if (st === 'PAID') return 'Ödendi';
  if (st === 'REQUESTED') return 'Talep edildi';
  return 'Bekliyor';
}

function orderStatusLabel(st: string): string {
  const m: Record<string, string> = {
    PENDING: 'Beklemede',
    SEARCHING_COURIER: 'Aranıyor',
    ACCEPTED: 'Kabul',
    PICKED_UP: 'Alındı',
    ON_DELIVERY: 'Yolda',
    DELIVERED: 'Teslim',
    CANCELLED: 'İptal',
  };
  return m[st] ?? st;
}

function payoutStatusMeta(st: MyPayoutRequest['status']): {
  label: string;
  tone: 'neutral' | 'info' | 'ok' | 'warn' | 'bad';
} {
  switch (st) {
    case 'PENDING':
      return { label: 'İnceleniyor', tone: 'info' };
    case 'APPROVED':
      return { label: 'Onaylandı', tone: 'warn' };
    case 'PAID':
      return { label: 'Ödendi', tone: 'ok' };
    case 'REJECTED':
      return { label: 'Reddedildi', tone: 'bad' };
    default:
      return { label: st, tone: 'neutral' };
  }
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: 'neutral' | 'info' | 'ok' | 'warn' | 'bad';
}) {
  return (
    <View style={[styles.badge, styles[`badge_${tone}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>
        {label}
      </Text>
    </View>
  );
}

function TodayVsYesterday({
  todayStr,
  yesterdayStr,
}: {
  todayStr: string;
  yesterdayStr: string;
}) {
  const today = parseNum(todayStr);
  const yesterday = parseNum(yesterdayStr);
  if (yesterday <= 0 && today <= 0) return null;

  if (yesterday <= 0 && today > 0) {
    return (
      <Text style={styles.heroCompareMuted}>
        Dün bu saatlerde henüz kayıt yok — devam!
      </Text>
    );
  }

  const diffPct =
    yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 100) : null;

  return (
    <View style={styles.heroCompareBlock}>
      <Text style={styles.heroDunLine}>
        Dün: {formatTryCompact(yesterdayStr)} ₺
      </Text>
      {diffPct != null ? (
        <View
          style={[
            styles.compareChip,
            diffPct >= 0 ? styles.compareChipUp : styles.compareChipDown,
          ]}
        >
          <Text
            style={[
              styles.compareChipText,
              diffPct >= 0 ? styles.compareChipTextUp : styles.compareChipTextDown,
            ]}
          >
            {diffPct >= 0 ? '▲' : '▼'} {Math.abs(diffPct)}% düne göre
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function EarningsProgressBar({
  paid,
  total,
}: {
  paid: number;
  total: number;
}) {
  if (total <= 0) {
    return (
      <View style={styles.progressTrack}>
        <View style={[styles.progressFillMuted, { flex: 1 }]} />
      </View>
    );
  }
  const unpaid = Math.max(0, total - paid);
  if (unpaid <= 0) {
    return (
      <View style={styles.progressTrack}>
        <View style={[styles.progressFillPaid, { flex: 1 }]} />
      </View>
    );
  }
  if (paid <= 0) {
    return (
      <View style={styles.progressTrack}>
        <View style={[styles.progressFillMuted, { flex: 1 }]} />
      </View>
    );
  }
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFillPaid, { flex: paid }]} />
      <View style={[styles.progressFillMuted, { flex: unpaid }]} />
    </View>
  );
}

export default function EarningsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: courier, isLoading: loadingCourier } = useQuery({
    queryKey: ['courier', 'me'],
    queryFn: fetchCourierMe,
  });

  const summaryQ = useQuery({
    queryKey: ['earnings', 'summary'],
    queryFn: fetchEarningsSummary,
    enabled: Boolean(courier),
  });

  const earningsQ = useQuery({
    queryKey: ['earnings', 'list'],
    queryFn: fetchMyEarnings,
    enabled: Boolean(courier),
  });

  const payoutsQ = useQuery({
    queryKey: ['payouts', 'mine'],
    queryFn: fetchMyPayoutRequests,
    enabled: Boolean(courier),
  });

  const requestPayout = useMutation({
    mutationFn: createPayoutRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['earnings', 'summary'] });
      void queryClient.invalidateQueries({ queryKey: ['earnings', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['payouts', 'mine'] });
    },
  });

  const bankOk = courier ? hasCompleteBankProfile(courier) : false;
  const summary = summaryQ.data;
  const withdrawable = summary ? parseNum(summary.withdrawableTry) : 0;
  const minPayout = summary ? parseNum(summary.minPayoutTry) : 100;
  const openPayout = payoutsQ.data?.some(
    (p) => p.status === 'PENDING' || p.status === 'APPROVED',
  );

  const meetsMinimum = withdrawable >= minPayout;
  const canRequest =
    bankOk &&
    withdrawable > 0 &&
    meetsMinimum &&
    !openPayout &&
    !requestPayout.isPending;

  const payoutDisabledHint = (): string | null => {
    if (!bankOk) return null;
    if (openPayout) return null;
    if (withdrawable <= 0) return null;
    if (!meetsMinimum) return 'Minimum tutara ulaşmadınız';
    return null;
  };

  if (loadingCourier || !courier) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const totalEarned = summary ? parseNum(summary.totalEarningsTry) : 0;
  const paid = summary ? parseNum(summary.paidTry) : 0;
  const requested = summary ? parseNum(summary.requestedTry) : 0;
  const outstanding = Math.max(0, totalEarned - paid);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={earningsQ.data ?? []}
        keyExtractor={(item) => item.id}
        refreshing={
          summaryQ.isFetching || earningsQ.isFetching || payoutsQ.isFetching
        }
        onRefresh={() => {
          void summaryQ.refetch();
          void earningsQ.refetch();
          void payoutsQ.refetch();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Kazançlarım</Text>

            {summaryQ.isError ? (
              <Text style={styles.err}>{formatApiError(summaryQ.error)}</Text>
            ) : null}

            {/* 1) Hero */}
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>Bugün</Text>
              <Text style={styles.heroAmount}>
                {summary?.todayEarningsTry != null
                  ? formatTryCompact(summary.todayEarningsTry)
                  : '—'}
                <Text style={styles.heroCurrency}> ₺</Text>
              </Text>
              <Text style={styles.heroSub}>Bugün kazandın</Text>
              {summary ? (
                <TodayVsYesterday
                  todayStr={summary.todayEarningsTry}
                  yesterdayStr={summary.yesterdayEarningsTry}
                />
              ) : null}
            </View>

            {/* 2) Çekilebilir */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Talep edilebilir bakiye</Text>
              <Text style={styles.withdrawValue}>
                {summary ? formatTry(summary.withdrawableTry) : '—'}
              </Text>
              {!bankOk ? (
                <Text style={styles.cardHint}>
                  Ödeme için profilde banka bilgilerinizi tamamlayın.
                </Text>
              ) : null}
              {openPayout ? (
                <Text style={styles.cardHint}>
                  Açık bir ödeme talebiniz var; sonuçlanınca yeni talep
                  oluşturabilirsiniz.
                </Text>
              ) : null}
              {payoutDisabledHint() ? (
                <Text style={styles.cardWarn}>{payoutDisabledHint()}</Text>
              ) : null}
              {withdrawable <= 0 && bankOk && !openPayout ? (
                <Text style={styles.cardHint}>
                  Teslim ettiğiniz siparişlerde kazanç burada birikir.
                </Text>
              ) : null}

              <PrimaryButton
                title={
                  requestPayout.isPending ? 'Gönderiliyor…' : 'Ödeme talep et'
                }
                loading={requestPayout.isPending}
                onPress={() => requestPayout.mutate()}
                disabled={!canRequest}
                style={styles.ctaBtn}
              />
              {!bankOk ? (
                <PrimaryButton
                  title="Banka bilgilerine git"
                  variant="outline"
                  onPress={() => router.push('/(main)/profile')}
                  style={styles.secondaryBtn}
                />
              ) : null}
              {minPayout > 0 && bankOk ? (
                <Text style={styles.minNote}>
                  Min. talep: {formatTryCompact(String(minPayout))} ₺
                </Text>
              ) : null}
              {requestPayout.isError ? (
                <Text style={styles.err}>
                  {formatApiError(requestPayout.error)}
                </Text>
              ) : null}
            </View>

            {/* 3) Özet + progress */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Kazanç özeti</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryVal}>
                    {summary ? formatTryCompact(summary.totalEarningsTry) : '—'} ₺
                  </Text>
                  <Text style={styles.summaryLbl}>Toplam</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={[styles.summaryVal, styles.summaryValOk]}>
                    {summary ? formatTryCompact(summary.paidTry) : '—'} ₺
                  </Text>
                  <Text style={styles.summaryLbl}>Ödenmiş</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={[styles.summaryVal, styles.summaryValPending]}>
                    {summary ? formatTryCompact(outstanding.toFixed(2)) : '—'} ₺
                  </Text>
                  <Text style={styles.summaryLbl}>Bekleyen</Text>
                </View>
              </View>
              {requested > 0 ? (
                <Text style={styles.requestedNote}>
                  Bunun {formatTryCompact(requested.toFixed(2))} ₺’si ödeme talebi
                  sürecinde.
                </Text>
              ) : null}
              <EarningsProgressBar paid={paid} total={totalEarned} />
              <View style={styles.progressLegend}>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, styles.legendPaid]} />
                  <Text style={styles.legendText}>Ödenmiş</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, styles.legendWait]} />
                  <Text style={styles.legendText}>Bekleyen</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Sipariş kazançları</Text>
          </View>
        }
        ListEmptyComponent={
          earningsQ.isLoading ? (
            <ActivityIndicator style={styles.listPad} color={HERO_ACCENT} />
          ) : earningsQ.isError ? (
            <Text style={styles.err}>{formatApiError(earningsQ.error)}</Text>
          ) : (
            <Text style={styles.empty}>
              Henüz kayıtlı kazanç yok. Teslimata devam — ilk kazancın yakında.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.orderCard}>
            <View style={styles.orderTop}>
              <Text style={styles.orderIdLbl}>Sipariş</Text>
              <Text style={styles.orderAmount}>+{formatTry(item.amount)}</Text>
            </View>
            <Text style={styles.orderIdVal}>#{shortOrderId(item.orderId)}</Text>
            <View style={styles.orderMeta}>
              <View style={styles.orderMetaLeft}>
                <Text style={styles.orderMetaText}>
                  {typeof item.order.routeKm === 'number'
                    ? `${item.order.routeKm} km`
                    : '— km'}
                </Text>
                <Text style={styles.orderMetaDot}>·</Text>
                <Text style={styles.orderMetaText}>
                  {orderStatusLabel(item.order.status)}
                </Text>
              </View>
              <Badge
                label={earningStatusLabel(item.status)}
                tone={
                  item.status === 'PAID'
                    ? 'ok'
                    : item.status === 'REQUESTED'
                      ? 'info'
                      : 'warn'
                }
              />
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.sectionTitle}>Ödeme talepleri</Text>
            {!payoutsQ.data || payoutsQ.data.length === 0 ? (
              <Text style={styles.emptyFooter}>
                Henüz ödeme talebiniz yok.
              </Text>
            ) : (
              payoutsQ.data.map((p) => {
                const meta = payoutStatusMeta(p.status);
                return (
                  <View key={p.id} style={styles.payoutCard}>
                    <View style={styles.payoutTop}>
                      <Text style={styles.payoutDate}>
                        {formatDateOnly(p.createdAt)}
                      </Text>
                      <Badge label={meta.label} tone={meta.tone} />
                    </View>
                    <Text style={styles.payoutAmount}>{formatTry(p.amount)}</Text>
                  </View>
                );
              })
            )}
            <View style={styles.bottomSpacer} />
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  header: { paddingHorizontal: 16, paddingTop: 4 },
  screenTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  hero: {
    backgroundColor: HERO_ACCENT_DARK,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  heroCurrency: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  heroCompareBlock: {
    marginTop: 12,
    gap: 8,
  },
  heroCompareMuted: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 10,
  },
  heroDunLine: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },
  compareChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  compareChipUp: { backgroundColor: 'rgba(255,255,255,0.2)' },
  compareChipDown: { backgroundColor: 'rgba(0,0,0,0.15)' },
  compareChipText: { fontSize: 12, fontWeight: '700' },
  compareChipTextUp: { color: '#a7f3d0' },
  compareChipTextDown: { color: '#fecaca' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  withdrawValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
    letterSpacing: -0.3,
  },
  cardHint: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 8,
    lineHeight: 18,
  },
  cardWarn: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
    marginTop: 8,
  },
  ctaBtn: { marginTop: 14 },
  secondaryBtn: { marginTop: 8 },
  minNote: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  summaryCell: {
    flex: 1,
    backgroundColor: colors.surfaceTint,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  summaryVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  summaryValOk: { color: colors.success },
  summaryValPending: { color: HERO_ACCENT },
  summaryLbl: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  requestedNote: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 10,
    lineHeight: 17,
  },
  progressTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 14,
    backgroundColor: colors.border,
  },
  progressFillPaid: {
    backgroundColor: colors.success,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  progressFillMuted: {
    backgroundColor: colors.surfaceTint,
  },
  progressLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendPaid: { backgroundColor: colors.success },
  legendWait: { backgroundColor: colors.surfaceTint, borderWidth: 1, borderColor: colors.border },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
    marginBottom: 10,
  },
  err: { color: colors.danger, fontSize: 13, marginBottom: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 8 },
  listPad: { marginVertical: 20 },
  empty: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  emptyFooter: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: 8,
  },
  orderCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderIdLbl: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  orderAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.success,
  },
  orderIdVal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  orderMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  orderMetaText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  orderMetaDot: { fontSize: 13, color: colors.border, fontWeight: '700' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  badge_neutral: { backgroundColor: colors.surfaceTint },
  badge_info: { backgroundColor: '#e0f2fe' },
  badge_ok: { backgroundColor: colors.onlineTint },
  badge_warn: { backgroundColor: '#fef9c3' },
  badge_bad: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgeText_neutral: { color: colors.muted },
  badgeText_info: { color: '#0369a1' },
  badgeText_ok: { color: colors.success },
  badgeText_warn: { color: '#a16207' },
  badgeText_bad: { color: colors.danger },
  footer: { marginTop: 8 },
  payoutCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  payoutTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payoutDate: { fontSize: 13, fontWeight: '600', color: colors.muted },
  payoutAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
  },
  bottomSpacer: { height: 28 },
});
