import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { registerCourierOnboarding } from '../../src/lib/api/auth.api';
import type { CourierType } from '../../src/lib/api/types';
import { isValidTurkishNationalId } from '../../src/lib/validation/tcKimlik';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';

const STEPS = 4;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Görünüm: GG/AA/YY (yerel takvim gün/ay/yılın son iki hanesi) */
function formatBirthGG_AA_YY(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${pad2(d.getFullYear() % 100)}`;
}

/** API için YYYY-MM-DD (yerel gün, saat dilimi kayması yok) */
function toIsoLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Bugün itibarıyla en geç seçilebilecek doğum günü (tam 18 yaş) */
function maxBirthDateForAge18(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setFullYear(d.getFullYear() - 18);
  return d;
}

function minBirthDate(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setFullYear(d.getFullYear() - 100);
  return d;
}

function isAtLeast18(birth: Date): boolean {
  const limit = maxBirthDateForAge18();
  const b = new Date(birth);
  b.setHours(12, 0, 0, 0);
  return b.getTime() <= limit.getTime();
}

/** Web veya manuel giriş için GG/AA/YY ayrıştırma */
function parseGG_AA_YY(s: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const yy = parseInt(m[3], 10);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const currentYY = new Date().getFullYear() % 100;
  const fullYear = yy <= currentYY + 1 ? 2000 + yy : 1900 + yy;
  const d = new Date(fullYear, month, day, 12, 0, 0, 0);
  if (d.getFullYear() !== fullYear || d.getMonth() !== month || d.getDate() !== day) {
    return null;
  }
  return d;
}

export default function RegisterScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [step, setStep] = useState(0);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [birthDate, setBirthDate] = useState<Date | null>(null);
  /** Web: GG/AA/YY metin alanı */
  const [webBirthRaw, setWebBirthRaw] = useState('');
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [iosPickerTemp, setIosPickerTemp] = useState<Date>(() => maxBirthDateForAge18());
  const [tcNo, setTcNo] = useState('');

  const [hasCompany, setHasCompany] = useState<boolean | null>(null);
  const [companyTaxId, setCompanyTaxId] = useState('');
  const [companyTaxOffice, setCompanyTaxOffice] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [residenceAddress, setResidenceAddress] = useState('');

  const [vehicleType, setVehicleType] = useState<CourierType>('MOTORCYCLE');
  const [plateNumber, setPlateNumber] = useState('');

  const stepError = useMemo(() => {
    if (step === 0) {
      if (fullName.trim().length < 2) return 'Ad soyad en az 2 karakter olmalı';
      if (phone.replace(/\D/g, '').length < 10) return 'Geçerli bir telefon girin';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return 'Geçerli bir e-posta girin';
      }
      if (password.length < 8) return 'Şifre en az 8 karakter olmalı';
      return null;
    }
    if (step === 1) {
      const birth =
        Platform.OS === 'web' ? parseGG_AA_YY(webBirthRaw) : birthDate;
      if (!birth) {
        return Platform.OS === 'web'
          ? 'Doğum tarihini GG/AA/YY formatında girin (örn. 15/03/95)'
          : 'Doğum tarihini takvimden seçin';
      }
      if (!isAtLeast18(birth)) {
        return 'Kayıt için en az 18 yaşında olmalısınız';
      }
      const tc = tcNo.replace(/\D/g, '');
      if (tc.length !== 11) return 'T.C. kimlik numarası 11 haneli olmalı';
      if (!isValidTurkishNationalId(tc)) {
        return 'T.C. kimlik numarası geçersiz (algoritma kontrolü)';
      }
      return null;
    }
    if (step === 2) {
      if (hasCompany === null) return 'Şirket durumunu seçin';
      if (hasCompany) {
        if (companyTaxId.trim().length < 5) return 'Vergi numarasını girin';
        if (companyTaxOffice.trim().length < 2) return 'Vergi dairesini girin';
        if (companyAddress.trim().length < 10) return 'Şirket adresini girin';
      } else {
        if (residenceAddress.trim().length < 10) return 'İkametgah adresini girin';
      }
      return null;
    }
    if (step === 3) {
      if (plateNumber.replace(/\s/g, '').length < 5) return 'Araç plakasını girin';
      return null;
    }
    return null;
  }, [
    step,
    fullName,
    phone,
    email,
    password,
    birthDate,
    webBirthRaw,
    tcNo,
    hasCompany,
    companyTaxId,
    companyTaxOffice,
    companyAddress,
    residenceAddress,
    plateNumber,
  ]);

  const openBirthDatePicker = useCallback(() => {
    const maxD = maxBirthDateForAge18();
    const minD = minBirthDate();
    const value = birthDate ?? maxD;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        maximumDate: maxD,
        minimumDate: minD,
        onChange: (event, date) => {
          if (event.type !== 'set' || !date) return;
          const next = new Date(date);
          next.setHours(12, 0, 0, 0);
          setBirthDate(next);
        },
      });
      return;
    }

    if (Platform.OS === 'ios') {
      setIosPickerTemp(value);
      setIosPickerOpen(true);
    }
  }, [birthDate]);

  const mutation = useMutation({
    mutationFn: async () => {
      const birth =
        Platform.OS === 'web' ? parseGG_AA_YY(webBirthRaw) : birthDate;
      if (!birth || !isAtLeast18(birth)) {
        throw new Error('Geçerli bir doğum tarihi gerekli (en az 18 yaş)');
      }
      if (hasCompany === null) {
        throw new Error('Şirket bilgisi eksik');
      }
      return registerCourierOnboarding({
        email: email.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
        birthDate: toIsoLocalDate(birth),
        tcNo: tcNo.replace(/\D/g, ''),
        vehicleType,
        plateNumber: plateNumber.trim().toUpperCase(),
        hasCompany,
        ...(hasCompany
          ? {
              companyTaxId: companyTaxId.trim(),
              companyTaxOffice: companyTaxOffice.trim(),
              companyAddress: companyAddress.trim(),
            }
          : { residenceAddress: residenceAddress.trim() }),
      });
    },
    onSuccess: async (data) => {
      await setSession(data.accessToken, data.user);
      router.replace('/(main)/dashboard');
    },
    onError: (e: Error) => {
      Alert.alert('Kayıt', e.message || 'Başvuru gönderilemedi');
    },
  });

  function goNext() {
    if (stepError) {
      Alert.alert('Eksik veya hatalı', stepError);
      return;
    }
    if (step < STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      mutation.mutate();
    }
  }

  function goBack() {
    if (step > 0) {
      setStep((s) => s - 1);
    } else {
      router.replace('/(auth)/login');
    }
  }

  const titles = [
    'Hesap bilgileri',
    'Kimlik',
    'Şirket / adres',
    'Araç',
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepRow}>
            {Array.from({ length: STEPS }, (_, i) => (
              <View
                key={i}
                style={[styles.stepDot, i <= step && styles.stepDotActive]}
              />
            ))}
          </View>
          <Text style={styles.stepLabel}>
            Adım {step + 1} / {STEPS}
          </Text>
          <Text style={styles.title}>{titles[step]}</Text>
          <View style={styles.trustRow}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            <Text style={styles.trustText}>
              Bilgileriniz şifreli bağlantı ile iletilir ve güvenle saklanır.
            </Text>
          </View>

          {step === 0 ? (
            <>
              <Text style={styles.hint}>
                Bu bilgiler giriş ve başvuru takibi için kullanılır.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ad Soyad"
                placeholderTextColor={colors.muted}
                value={fullName}
                onChangeText={setFullName}
              />
              <TextInput
                style={styles.input}
                placeholder="Telefon (örn. 05xx xxx xx xx)"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
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
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={styles.hint}>
                T.C. kimlik numaranız yalnızca doğrulama için kullanılır; 11 hane ve
                resmi algoritmaya uygun olmalıdır.
              </Text>
              <Text style={styles.fieldLabel}>Doğum tarihi (GG/AA/YY)</Text>
              {Platform.OS === 'web' ? (
                <TextInput
                  style={styles.input}
                  placeholder="Örn. 15/03/95"
                  placeholderTextColor={colors.muted}
                  value={webBirthRaw}
                  onChangeText={setWebBirthRaw}
                  autoCapitalize="none"
                />
              ) : (
                <Pressable
                  style={styles.dateField}
                  onPress={openBirthDatePicker}
                  accessibilityRole="button"
                  accessibilityLabel="Doğum tarihi seç"
                >
                  <Text
                    style={
                      birthDate ? styles.dateFieldValue : styles.dateFieldPlaceholder
                    }
                  >
                    {birthDate
                      ? formatBirthGG_AA_YY(birthDate)
                      : 'Takvimden seçmek için dokunun'}
                  </Text>
                  <Ionicons name="calendar-outline" size={22} color={colors.primary} />
                </Pressable>
              )}
              <Text style={styles.ageHint}>
                Kayıt için minimum yaş 18&apos;dir. 18 yaşından küçükler kayıt
                olamaz.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="T.C. Kimlik No (11 hane)"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={11}
                value={tcNo}
                onChangeText={(t) => setTcNo(t.replace(/\D/g, '').slice(0, 11))}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.hint}>Şirketiniz var mı?</Text>
              <View style={styles.companyRow}>
                <Pressable
                  style={[
                    styles.companyCard,
                    hasCompany === true && styles.companyCardActive,
                  ]}
                  onPress={() => setHasCompany(true)}
                >
                  <Ionicons
                    name="business"
                    size={28}
                    color={hasCompany === true ? colors.primary : colors.muted}
                  />
                  <Text
                    style={[
                      styles.companyCardTitle,
                      hasCompany === true && styles.companyCardTitleActive,
                    ]}
                  >
                    Şirketim var
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.companyCard,
                    hasCompany === false && styles.companyCardActive,
                  ]}
                  onPress={() => setHasCompany(false)}
                >
                  <Ionicons
                    name="person"
                    size={28}
                    color={hasCompany === false ? colors.primary : colors.muted}
                  />
                  <Text
                    style={[
                      styles.companyCardTitle,
                      hasCompany === false && styles.companyCardTitleActive,
                    ]}
                  >
                    Yok (şahıs)
                  </Text>
                </Pressable>
              </View>
              {hasCompany === true ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Vergi numarası"
                    placeholderTextColor={colors.muted}
                    value={companyTaxId}
                    onChangeText={setCompanyTaxId}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Vergi dairesi"
                    placeholderTextColor={colors.muted}
                    value={companyTaxOffice}
                    onChangeText={setCompanyTaxOffice}
                  />
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    placeholder="Şirket adresi"
                    placeholderTextColor={colors.muted}
                    multiline
                    value={companyAddress}
                    onChangeText={setCompanyAddress}
                  />
                </>
              ) : null}
              {hasCompany === false ? (
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="İkametgah adresi"
                  placeholderTextColor={colors.muted}
                  multiline
                  value={residenceAddress}
                  onChangeText={setResidenceAddress}
                />
              ) : null}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.hint}>Son adım: araç tipi ve plaka.</Text>
              <Text style={styles.fieldLabel}>Araç tipi</Text>
              <View style={styles.row}>
                {(['MOTORCYCLE', 'CAR'] as const).map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.chip, vehicleType === t && styles.chipActive]}
                    onPress={() => setVehicleType(t)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        vehicleType === t && styles.chipTextActive,
                      ]}
                    >
                      {t === 'MOTORCYCLE' ? 'Motosiklet' : 'Araba'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Araç plakası"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                value={plateNumber}
                onChangeText={(t) => setPlateNumber(t.toUpperCase())}
              />
            </>
          ) : null}

          <View style={styles.btnRow}>
            <PrimaryButton
              title={step > 0 ? 'Geri' : 'İptal'}
              variant="outline"
              onPress={goBack}
              style={styles.btnHalf}
            />
            <PrimaryButton
              title={step === STEPS - 1 ? 'Başvuruyu gönder' : 'İleri'}
              loading={mutation.isPending}
              onPress={goNext}
              style={styles.btnHalf}
            />
          </View>

          <Text style={styles.footerNote}>
            Başvurunuz incelendikten sonra e-posta ile bilgilendirilirsiniz. Onay
            sonrası çevrimiçi olup iş alabilirsiniz.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={iosPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIosPickerOpen(false)}
        >
          <View style={styles.modalRoot}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setIosPickerOpen(false)}
            />
            <View style={styles.modalSheet}>
              <View style={styles.modalBar}>
                <Pressable
                  onPress={() => setIosPickerOpen(false)}
                  hitSlop={12}
                >
                  <Text style={styles.modalBarBtn}>İptal</Text>
                </Pressable>
                <Text style={styles.modalTitle}>Doğum tarihi</Text>
                <Pressable
                  onPress={() => {
                    const next = new Date(iosPickerTemp);
                    next.setHours(12, 0, 0, 0);
                    setBirthDate(next);
                    setIosPickerOpen(false);
                  }}
                  hitSlop={12}
                >
                  <Text style={[styles.modalBarBtn, styles.modalBarBtnPrimary]}>
                    Tamam
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={iosPickerTemp}
                mode="date"
                display="spinner"
                locale="tr_TR"
                themeVariant="light"
                maximumDate={maxBirthDateForAge18()}
                minimumDate={minBirthDate()}
                onChange={(_, date) => {
                  if (date) setIosPickerTemp(date);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surfaceTint,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  trustText: {
    flex: 1,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
    fontWeight: '600',
  },
  hint: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 12,
    lineHeight: 20,
  },
  ageHint: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 12,
    lineHeight: 19,
    fontWeight: '600',
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  dateFieldValue: { fontSize: 16, color: colors.text, fontWeight: '600' },
  dateFieldPlaceholder: { fontSize: 16, color: colors.muted },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalBarBtn: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  modalBarBtnPrimary: { color: colors.primary },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
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
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  chip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceTint,
  },
  chipText: { color: colors.muted, fontWeight: '700' },
  chipTextActive: { color: colors.primaryDark },
  companyRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  companyCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
  },
  companyCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceTint,
  },
  companyCardTitle: { fontSize: 14, fontWeight: '800', color: colors.muted },
  companyCardTitleActive: { color: colors.text },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnHalf: { flex: 1 },
  footerNote: {
    marginTop: 20,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
