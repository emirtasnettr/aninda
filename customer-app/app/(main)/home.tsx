import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { disconnectRealtimeSocket } from '../../src/lib/socket/realtime';
import { queryClient } from '../../src/lib/queryClient';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const onLogout = async () => {
    disconnectRealtimeSocket();
    queryClient.clear();
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <Text style={styles.greeting}>Merhaba</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hızlı erişim</Text>
          <Text style={styles.cardHint}>
            Alttaki menüden yeni sipariş oluşturabilir veya geçmişe gidebilirsiniz. Aktif
            sipariş takibi için geçmişten bir kayıt seçin.
          </Text>
        </View>

        <TouchableOpacity onPress={() => void onLogout()} style={styles.logoutWrap}>
          <Text style={styles.logout}>Çıkış yap</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 22 },
  greeting: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  email: { fontSize: 15, color: colors.muted, marginTop: 6, marginBottom: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cardHint: { fontSize: 14, color: colors.muted, marginTop: 10, lineHeight: 21 },
  logoutWrap: { marginTop: 'auto', paddingVertical: 16 },
  logout: { textAlign: 'center', color: colors.primary, fontWeight: '600', fontSize: 16 },
});
