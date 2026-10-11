import { useEffect, useState } from 'react';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { FormField } from '@/components/forms/FormField';
import { useAuth } from '@/contexts/AuthContext';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useMobileBranding } from '@/lib/branding';
import { appAlert } from '@/lib/appAlert';

const COMPANY_CATEGORIES = [
  'Elektrik & Elektronik',
  'Ev Gereçleri',
  'Yapı & Hırdavat',
  'Otomotiv',
  'Gıda',
  'Tekstil',
  'Kozmetik & Kişisel Bakım',
  'Petshop',
  'Market & Perakende',
  'Toptan Ticaret',
  'Diğer',
];

function isValidVknChecksum(value: string) {
  if (!/^\d{10}$/.test(value)) return false;

  const digits = value.split('').map(Number);
  const control = digits[9];
  const total = digits.slice(0, 9).reduce((sum, digit, index) => {
    const shifted = (digit + 9 - index) % 10;
    const weighted = shifted === 9 ? 9 : (shifted * 2 ** (9 - index)) % 9;
    return sum + weighted;
  }, 0);

  return (10 - (total % 10)) % 10 === control;
}

export default function SignupScreen() {
  const router = useRouter();
  const branding = useMobileBranding();
  const { registerApplication, verifyTaxNumber } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [companyCategory, setCompanyCategory] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [taxOffice, setTaxOffice] = useState('');
  const [taxValid, setTaxValid] = useState(false);
  const [taxVerified, setTaxVerified] = useState(false);
  const [taxChecking, setTaxChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setTaxOffice('');
    setTaxVerified(false);

    if (taxNumber.length !== 10) {
      setTaxValid(false);
      return;
    }

    const checksumValid = isValidVknChecksum(taxNumber);
    setTaxValid(checksumValid);
    if (!checksumValid) return;

    let active = true;
    const timer = setTimeout(async () => {
      setTaxChecking(true);
      try {
        const result = await verifyTaxNumber(taxNumber);
        if (!active) return;
        setTaxValid(Boolean(result.valid));
        setTaxVerified(Boolean(result.verified));
        setTaxOffice(result.taxOffice || '');
        if (result.companyName) {
          setCompanyName((current) => current.trim() || result.companyName || '');
        }
      } catch {
        // Web ile aynı davranış: dış vergi servisi ulaşılamıyorsa
        // doğru kontrol basamağına sahip VKN başvuruyu engellemez.
        if (!active) return;
        setTaxValid(checksumValid);
        setTaxVerified(false);
        setTaxOffice('');
      } finally {
        if (active) setTaxChecking(false);
      }
    }, 450);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [taxNumber, verifyTaxNumber]);

  const submit = async () => {
    if (companyName.trim().length < 2) {
      appAlert('Eksik bilgi', 'Firma ismini girin.');
      return;
    }
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      appAlert('Eksik bilgi', 'İsim ve soy isim girin.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      appAlert('E-posta geçersiz', 'Geçerli bir e-posta adresi girin.');
      return;
    }
    if (!companyCategory) {
      appAlert('Kategori seçin', 'Firma kategorinizi listeden seçin.');
      return;
    }
    if (!taxValid) {
      appAlert('Vergi numarası geçersiz', 'Geçerli 10 haneli vergi numarası girin.');
      return;
    }

    setSubmitting(true);
    try {
      await registerApplication({
        companyName: companyName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        companyCategory,
        taxNumber,
      });
      setCompleted(true);
    } catch (error) {
      appAlert(
        'Başvuru oluşturulamadı',
        error instanceof Error ? error.message : 'Lütfen tekrar deneyin.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <View style={styles.screen}>
        {branding.b2b_mobile_login_background ? (
          <ImageBackground source={{ uri: branding.b2b_mobile_login_background }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : null}
        <View style={styles.sceneDim} />
        <View style={styles.completed}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={34} color="#101010" />
          </View>
          <Text style={styles.successTitle}>Başvurunuz alındı</Text>
          <Text style={styles.successText}>
            Başvurunuz yönetici onayına gönderildi. Onaylandıktan sonra tek
            kullanımlık giriş şifreniz e-posta adresinize gönderilecektir.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace('/login')}>
            <Text style={styles.primaryButtonText}>Giriş Ekranına Dön</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {branding.b2b_mobile_login_background ? (
        <ImageBackground source={{ uri: branding.b2b_mobile_login_background }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
      ) : null}
      <View style={styles.sceneDim} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#FFCC00" />
          <Text style={styles.backText}>Giriş</Text>
        </Pressable>

        <View style={styles.brandHeader}>
          <Text style={styles.title}>İşletmemi <Text style={styles.accent}>Kaydet</Text></Text>
          <Text style={styles.subtitle}>
            Web sitesi ve mobil uygulama aynı Çalışkan B2B hesabını kullanır.
          </Text>
        </View>

        <View style={styles.card}>
          <FormField
            label="Firma İsmi"
            appearance="dark"
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="Firma unvanı"
          />

          <View style={styles.row}>
            <View style={styles.rowField}>
              <FormField
                label="İsim"
            appearance="dark"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Ad"
              />
            </View>
            <View style={styles.rowField}>
              <FormField
                label="Soy İsim"
            appearance="dark"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Soyad"
              />
            </View>
          </View>

          <FormField
            label="E-posta Adresi"
            appearance="dark"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ornek@firma.com"
          />

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Firma Kategorisi</Text>
            <View style={styles.categoryGrid}>
              {COMPANY_CATEGORIES.map((category) => {
                const selected = companyCategory === category;
                return (
                  <Pressable
                    key={category}
                    style={[
                      styles.categoryChip,
                      selected && styles.categoryChipSelected,
                    ]}
                    onPress={() => setCompanyCategory(category)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selected && styles.categoryChipTextSelected,
                      ]}
                    >
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.helperText}>
              Kategori serbest metin değildir; web sitesindeki aynı listeden seçilir.
            </Text>
          </View>

          <FormField
            label="Vergi Numarası"
            appearance="dark"
            value={taxNumber}
            onChangeText={(value) =>
              setTaxNumber(value.replace(/\D/g, '').slice(0, 10))
            }
            keyboardType="number-pad"
            placeholder="10 hane"
            rightSlot={
              <View style={styles.taxStatus}>
                {taxChecking ? (
                  <Ionicons name="sync-outline" size={19} color="#FFCC00" />
                ) : taxVerified ? (
                  <Ionicons name="checkmark-circle" size={20} color="#FFCC00" />
                ) : taxNumber.length === 10 && taxValid ? (
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFCC00" />
                ) : null}
              </View>
            }
          />

          <View style={styles.taxOfficeBox}>
            <Text style={styles.taxOfficeLabel}>Vergi Dairesi</Text>
            <Text style={styles.taxOfficeValue}>
              {taxChecking
                ? 'Sorgulanıyor…'
                : taxOffice || (taxValid ? 'Dış servis doğrulaması bekleniyor' : 'VKN ile otomatik belirlenir')}
            </Text>
          </View>

          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={20} color="#FFCC00" />
            <Text style={styles.noticeText}>
              Başvuru sırasında şifre oluşturulmaz. Başvurunuz onaylandıktan sonra
              tek kullanımlık şifre e-postanıza gönderilir. İlk girişte kalıcı
              şifrenizi oluşturursunuz.
            </Text>
          </View>

          <Pressable
            style={[
              styles.primaryButton,
              (submitting || taxChecking) && styles.disabled,
            ]}
            onPress={submit}
            disabled={submitting || taxChecking}
          >
            <Ionicons name="person-add-outline" size={19} color="#101010" />
            <Text style={styles.primaryButtonText}>
              {submitting ? 'Başvuru gönderiliyor…' : 'Başvuruyu Gönder'}
            </Text>
          </Pressable>

          <Pressable style={styles.loginLink} onPress={() => router.replace('/login')}>
            <Text style={styles.loginLinkText}>
              Zaten hesabınız var mı? Giriş yapın
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sceneDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  accent: { color: '#FFCC00' },
  screen: { flex: 1, backgroundColor: '#101010' },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
  },
  back: {
    minHeight: minTouchTarget,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#575757',
    backgroundColor: 'rgba(12,12,12,0.83)',
  },
  backText: { ...typography.bodyMedium, color: '#FFCC00', fontWeight: '700' },
  brandHeader: { marginTop: spacing.lg, marginBottom: spacing.xl },
  title: { ...typography.largeTitle, color: '#FFFFFF', fontWeight: '900' },
  subtitle: { ...typography.body, color: '#D5D5D5', marginTop: spacing.xs },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,204,0,0.45)',
    backgroundColor: 'rgba(12,12,12,0.95)',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  rowField: { flex: 1 },
  fieldGroup: { gap: spacing.sm },
  label: { ...typography.bodyMedium, color: '#FFFFFF', fontWeight: '700' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: {
    minHeight: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#555555',
    backgroundColor: '#202020',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipSelected: { backgroundColor: '#FFCC00', borderColor: '#FFCC00' },
  categoryChipText: { ...typography.caption, color: '#EBEBEB', fontWeight: '700' },
  categoryChipTextSelected: { color: '#101010' },
  helperText: { ...typography.caption, color: '#BBBBBB' },
  taxStatus: {
    position: 'absolute',
    right: spacing.md,
    top: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taxOfficeBox: { borderRadius: radius.md, backgroundColor: '#242424', padding: spacing.md },
  taxOfficeLabel: { ...typography.caption, color: '#BBBBBB' },
  taxOfficeValue: { ...typography.bodyMedium, color: '#FFFFFF', marginTop: 2 },
  notice: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#444444',
    backgroundColor: '#222222',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noticeText: { ...typography.caption, color: '#D5D5D5', flex: 1, lineHeight: 18 },
  primaryButton: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: '#FFCC00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: { ...typography.bodyMedium, color: '#101010', fontWeight: '900' },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  secondaryButtonText: { ...typography.bodyMedium, color: '#FFCC00', fontWeight: '800' },
  loginLink: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  loginLinkText: { ...typography.bodyMedium, color: '#FFCC00', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  completed: { flex: 1, justifyContent: 'center', padding: spacing.xxl },
  successIcon: {
    width: 70, height: 70, borderRadius: radius.full, backgroundColor: '#FFCC00',
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { ...typography.largeTitle, color: '#FFFFFF', fontWeight: '900', marginTop: spacing.xl },
  successText: { ...typography.body, color: '#DADADA', marginTop: spacing.sm, marginBottom: spacing.lg },
});
