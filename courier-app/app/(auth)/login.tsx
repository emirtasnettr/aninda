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
import { Image } from 'expo-image';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { loginRequest } from '../../src/lib/api/auth.api';
import { getApiBaseUrl } from '../../src/lib/api/config';
import { formatApiError } from '../../src/lib/api/error-message';
import {
  fetchPublicSettings,
  resolveBrandingLogoUri,
} from '../../src/lib/api/settings.api';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';

const DEFAULT_APP_NAME = 'Teslimatjet';

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const brandingQuery = useQuery({
    queryKey: ['public-settings'],
    queryFn: fetchPublicSettings,
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  const displayName =
    brandingQuery.data?.appName?.trim() || DEFAULT_APP_NAME;
  const logoUri = resolveBrandingLogoUri(brandingQuery.data?.logoUrl ?? null);

  const mutation = useMutation({
    mutationFn: () => loginRequest(email.trim(), password),
    onSuccess: async (data) => {
      if (data.user.role !== 'COURIER') {
        Alert.alert(
          'Kurye hesabı gerekli',
          `Bu uygulama yalnızca kurye girişi kabul eder. Seçilen hesabın rolü: ${data.user.role}.`,
        );
        return;
      }
      await setSession(data.accessToken, data.user);
      router.replace('/(main)/dashboard');
    },
    onError: (err: unknown) => {
      Alert.alert('Giriş başarısız', formatApiError(err));
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.brandBlock}>
        {logoUri ? (
          <Image
            source={{ uri: logoUri }}
            style={styles.logo}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={200}
            accessibilityLabel={displayName}
          />
        ) : (
          <Text style={styles.title}>{displayName}</Text>
        )}
      </View>
      <Text style={styles.subtitle}>Kurye girişi</Text>
      {__DEV__ ? (
        <Text style={styles.apiHint} numberOfLines={2}>
          API: {getApiBaseUrl()}
        </Text>
      ) : null}

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
        placeholder="Şifre"
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <PrimaryButton
        title="Giriş yap"
        loading={mutation.isPending}
        onPress={() => mutation.mutate()}
        style={styles.btn}
      />

      <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
        <Text style={styles.link}>Hesabın yok mu? Kayıt ol</Text>
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
  brandBlock: {
    minHeight: 88,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  logo: {
    width: '100%',
    maxWidth: 280,
    height: 80,
    maxHeight: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  apiHint: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
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
  btn: {
    marginTop: 8,
  },
  link: {
    marginTop: 24,
    textAlign: 'center',
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
