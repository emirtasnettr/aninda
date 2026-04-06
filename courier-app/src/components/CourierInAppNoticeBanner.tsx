import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCourierInAppNoticeStore } from '../store/courierInAppNoticeStore';
import { colors } from '../theme/colors';

const AUTO_MS = 8000;

export function CourierInAppNoticeBanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const current = useCourierInAppNoticeStore((s) => s.queue[0]);
  const dismiss = useCourierInAppNoticeStore((s) => s.dismiss);

  useEffect(() => {
    if (!current) return;
    const id = current.id;
    const t = setTimeout(() => dismiss(id), AUTO_MS);
    return () => clearTimeout(t);
  }, [current?.id, dismiss]);

  if (!current) return null;

  const onOpen = () => {
    if (current.orderId) {
      router.push(`/(main)/delivery/${current.orderId}`);
    }
    dismiss();
  };

  return (
    <View
      style={[styles.wrap, { paddingTop: Math.max(insets.top, 8) + 4 }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.96 }]}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="notifications" size={22} color={colors.primary} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body} numberOfLines={2}>
            {current.body}
          </Text>
          {current.orderId ? (
            <Text style={styles.cta}>Dokun — teslimata git</Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => dismiss()}
          hitSlop={12}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="close" size={22} color={colors.muted} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, color: colors.muted, marginTop: 4, fontWeight: '500' },
  cta: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0d9488',
    marginTop: 8,
  },
  closeBtn: { padding: 4 },
});
