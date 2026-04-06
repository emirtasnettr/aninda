import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState } from 'react';
import {
  submitCourierDocumentsForReview,
  uploadCourierDocument,
} from '../lib/api/couriers.api';
import { getApiBaseUrl } from '../lib/api/config';
import type {
  CourierDocumentSlot,
  CourierDocumentType,
  CourierProfile,
} from '../lib/api/types';
import { colors } from '../theme/colors';

const DOC_ROWS: { type: CourierDocumentType; label: string }[] = [
  { type: 'ID_FRONT', label: 'Kimlik (ön yüz)' },
  { type: 'LICENSE_FRONT', label: 'Ehliyet (ön)' },
  { type: 'LICENSE_BACK', label: 'Ehliyet (arka)' },
  { type: 'RESIDENCE', label: 'İkametgah' },
  { type: 'CRIMINAL_RECORD', label: 'Sabıka kaydı' },
];

function slotIcon(s: CourierDocumentSlot) {
  switch (s.reviewStatus) {
    case 'APPROVED':
      return { name: 'checkmark-circle' as const, color: colors.primary };
    case 'REJECTED':
      return { name: 'close-circle' as const, color: colors.danger };
    case 'PENDING_REVIEW':
      return { name: 'time' as const, color: '#b45309' };
    default:
      return { name: 'ellipse-outline' as const, color: colors.muted };
  }
}

function statusLabel(s: CourierDocumentSlot): string {
  switch (s.reviewStatus) {
    case 'APPROVED':
      return 'Onaylandı';
    case 'REJECTED':
      return 'Reddedildi — yeniden yükleyin';
    case 'PENDING_REVIEW':
      return 'İnceleme bekliyor';
    default:
      return 'Yüklenmedi';
  }
}

function absoluteFileUrl(relative: string | null): string | null {
  if (!relative) return null;
  if (relative.startsWith('http')) return relative;
  const base = getApiBaseUrl().replace(/\/$/, '');
  return `${base}${relative.startsWith('/') ? '' : '/'}${relative}`;
}

type Props = {
  profile: CourierProfile;
  onLogout: () => Promise<void>;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function CourierDocumentsFlow({
  profile,
  onLogout,
  refreshing,
  onRefresh,
}: Props) {
  const queryClient = useQueryClient();
  const [busyType, setBusyType] = useState<CourierDocumentType | null>(null);

  const uploadMu = useMutation({
    mutationFn: async ({
      docType,
      file,
    }: {
      docType: CourierDocumentType;
      file: { uri: string; name: string; type: string };
    }) => uploadCourierDocument(docType, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courier', 'me'] });
    },
  });

  const submitMu = useMutation({
    mutationFn: submitCourierDocumentsForReview,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courier', 'me'] });
    },
  });

  const documents = profile.documents ?? [];

  const allUploaded = documents.every((d) => d.fileUrl);
  const hasRejected = documents.some((d) => d.reviewStatus === 'REJECTED');
  const hasMissing = documents.some((d) => d.reviewStatus === 'MISSING');
  const canSubmit =
    allUploaded &&
    !hasRejected &&
    !hasMissing &&
    documents.some((d) => d.reviewStatus === 'PENDING_REVIEW');

  async function runUpload(docType: CourierDocumentType, file: {
    uri: string;
    name: string;
    type: string;
  }) {
    setBusyType(docType);
    try {
      await uploadMu.mutateAsync({ docType, file });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Yükleme başarısız';
      Alert.alert('Hata', msg);
    } finally {
      setBusyType(null);
    }
  }

  async function pickFromGallery(docType: CourierDocumentType) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Galeri erişimine izin verin.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.88,
      allowsMultipleSelection: false,
    });
    if (r.canceled) return;
    const a = r.assets[0];
    if (!a?.uri) return;
    const name = a.fileName ?? `${docType.toLowerCase()}.jpg`;
    const type = a.mimeType ?? 'image/jpeg';
    await runUpload(docType, { uri: a.uri, name, type });
  }

  async function pickDocument(docType: CourierDocumentType) {
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (r.canceled || !r.assets?.length) return;
    const a = r.assets[0];
    await runUpload(docType, {
      uri: a.uri,
      name: a.name || `${docType.toLowerCase()}.pdf`,
      type: a.mimeType || 'application/pdf',
    });
  }

  function chooseSource(docType: CourierDocumentType) {
    Alert.alert('Evrak seç', 'Fotoğraf veya PDF yükleyebilirsiniz.', [
      { text: 'Galeri', onPress: () => void pickFromGallery(docType) },
      { text: 'Dosya (PDF/resim)', onPress: () => void pickDocument(docType) },
      { text: 'İptal', style: 'cancel' },
    ]);
  }

  async function onSubmit() {
    try {
      await submitMu.mutateAsync();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gönderilemedi';
      Alert.alert('Hata', msg);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollInner}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>Başvuru adımları</Text>
        <View style={styles.stepsList}>
          <ProgressRow
            icon="checkmark-circle"
            iconColor={colors.primary}
            title="Adım 1: Kayıt"
            subtitle="Tamamlandı"
          />
          <ProgressRow
            icon="document-text"
            iconColor="#2563eb"
            title="Adım 2: Evrak yükleme"
            subtitle="Devam ediyor"
          />
          <ProgressRow
            icon="hourglass-outline"
            iconColor={colors.muted}
            title="Adım 3: Onay bekleniyor"
            subtitle="Evraklar gönderildikten sonra"
            muted
          />
        </View>
      </View>

      <Text style={styles.intro}>
        Ön onayınız tamamlandı. Aşağıdaki evrakların tamamını yükleyip
        &quot;İncelemeye gönder&quot; ile operasyon ekibine iletin.
      </Text>

      <View style={styles.list}>
        {DOC_ROWS.map(({ type, label }) => {
          const slot = documents.find((d) => d.type === type) ?? {
            type,
            fileUrl: null,
            reviewStatus: 'MISSING' as const,
            rejectionReason: null,
          };
          const ic = slotIcon(slot);
          const locked = slot.reviewStatus === 'APPROVED';
          const uploading = busyType === type;

          return (
            <View key={type} style={styles.card}>
              <View style={styles.cardTop}>
                <Ionicons name={ic.name} size={22} color={ic.color} />
                <View style={styles.cardTitles}>
                  <Text style={styles.cardLabel}>{label}</Text>
                  <Text style={styles.cardStatus}>{statusLabel(slot)}</Text>
                  {slot.rejectionReason?.trim() ? (
                    <Text style={styles.rejectReason}>{slot.rejectionReason}</Text>
                  ) : null}
                </View>
              </View>
              {slot.fileUrl ? (
                <Pressable
                  style={styles.linkBtn}
                  onPress={() => {
                    const url = absoluteFileUrl(slot.fileUrl);
                    if (url) void Linking.openURL(url);
                  }}
                >
                  <Text style={styles.linkBtnText}>Dosyayı aç</Text>
                </Pressable>
              ) : null}
              {!locked ? (
                <Pressable
                  style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
                  disabled={uploading || uploadMu.isPending}
                  onPress={() => chooseSource(type)}
                >
                  {uploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.uploadBtnText}>
                      {slot.fileUrl ? 'Yeniden yükle' : 'Yükle'}
                    </Text>
                  )}
                </Pressable>
              ) : (
                <Text style={styles.lockedHint}>Onaylı — değiştirilemez</Text>
              )}
            </View>
          );
        })}
      </View>

      <Pressable
        style={[styles.submitBtn, (!canSubmit || submitMu.isPending) && styles.submitBtnDisabled]}
        disabled={!canSubmit || submitMu.isPending}
        onPress={() => void onSubmit()}
      >
        {submitMu.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>İncelemeye gönder</Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.gateBtnOutline, { marginTop: 12 }]}
        onPress={() => void onLogout()}
      >
        <Text style={styles.gateBtnTextOutline}>Çıkış yap</Text>
      </Pressable>
    </ScrollView>
  );
}

function ProgressRow({
  icon,
  iconColor,
  title,
  subtitle,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.progressRow}>
      <Ionicons name={icon} size={22} color={iconColor} />
      <View style={styles.progressRowText}>
        <Text style={[styles.progressRowTitle, muted && styles.progressRowTitleMuted]}>
          {title}
        </Text>
        <Text style={styles.progressRowSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  progressCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 14,
  },
  stepsList: { gap: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressRowText: { flex: 1, minWidth: 0 },
  progressRowTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  progressRowTitleMuted: { color: colors.muted, fontWeight: '700' },
  progressRowSub: { marginTop: 2, fontSize: 12, color: colors.muted, fontWeight: '600' },
  intro: {
    marginTop: 18,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 21,
    fontWeight: '500',
  },
  list: { marginTop: 20, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', gap: 10 },
  cardTitles: { flex: 1, minWidth: 0 },
  cardLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardStatus: { marginTop: 4, fontSize: 13, color: colors.muted, fontWeight: '600' },
  rejectReason: {
    marginTop: 6,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
  linkBtn: { marginTop: 10, alignSelf: 'flex-start' },
  linkBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  uploadBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  lockedHint: {
    marginTop: 10,
    fontSize: 12,
    color: colors.muted,
    fontStyle: 'italic',
  },
  submitBtn: {
    marginTop: 24,
    backgroundColor: '#0f766e',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  gateBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  gateBtnTextOutline: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
