import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { registerCustomerRequest } from '../../src/lib/api/auth.api';
import type { CustomerRole } from '../../src/lib/api/types';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';

export default function RegisterScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<CustomerRole>('INDIVIDUAL_CUSTOMER');

  const mutation = useMutation({
    mutationFn: () => registerCustomerRequest(email.trim(), password, role),
    onSuccess: async (data) => {
      await setSession(data.accessToken, data.user);
      router.replace('/(main)/home');
    },
    onError: () => {
      Alert.alert('Hata', 'Kayıt başarısız. E-posta kullanımda olabilir.');
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Kayıt ol</Text>
      <Text style={styles.subtitle}>Bireysel veya kurumsal müşteri</Text>

      <TextInput
        style={styles.input}
        placeholder="E-posta"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Şifre (min. 8 karakter)"
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Text style={styles.label}>Hesap tipi</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.chip, role === 'INDIVIDUAL_CUSTOMER' && styles.chipActive]}
          onPress={() => setRole('INDIVIDUAL_CUSTOMER')}
        >
          <Text
            style={[
              styles.chipText,
              role === 'INDIVIDUAL_CUSTOMER' && styles.chipTextActive,
            ]}
          >
            Bireysel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, role === 'CORPORATE_CUSTOMER' && styles.chipActive]}
          onPress={() => setRole('CORPORATE_CUSTOMER')}
        >
          <Text
            style={[
              styles.chipText,
              role === 'CORPORATE_CUSTOMER' && styles.chipTextActive,
            ]}
          >
            Kurumsal
          </Text>
        </TouchableOpacity>
      </View>

      <PrimaryButton
        title="Kayıt ol"
        loading={mutation.isPending}
        onPress={() => mutation.mutate()}
        style={styles.btn}
      />

      <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
        <Text style={styles.link}>Zaten hesabın var mı?</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    color: colors.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 4,
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceTint,
  },
  chipText: { color: colors.muted, fontWeight: '600' },
  chipTextActive: { color: colors.primaryDark },
  btn: { marginTop: 8 },
  link: {
    marginTop: 24,
    textAlign: 'center',
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
