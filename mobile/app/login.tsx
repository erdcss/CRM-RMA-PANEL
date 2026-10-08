import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { FormField } from '@/components/forms/FormField';
import { useAuth } from '@/contexts/AuthContext';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useMobileBranding } from '@/lib/branding';
import { appAlert } from '@/lib/appAlert';

export default function LoginScreen() {
  const branding = useMobileBranding();
  const router = useRouter();
  const { session, signIn, completeInitialPassword, forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [passwordSetupVisible, setPasswordSetupVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordAgain, setNewPasswordAgain] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (session?.user?.mustChangePassword) {
      setPasswordSetupVisible(true);
    }
  }, [session?.user?.mustChangePassword]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      appAlert('Eksik bilgi', 'E-posta ve şifre girin.');
      return;
    }

    setSubmitting(true);
    try {
      const session = await signIn(email, password);

      if (session.user.mustChangePassword) {
        setPassword('');
        setPasswordSetupVisible(true);
        return;
      }

      router.replace('/(tabs)');
    } catch (error) {
      appAlert(
        'Giriş başarısız',
        error instanceof Error ? error.message : 'E-posta veya şifre hatalı.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const saveInitialPassword = async () => {
    if (newPassword.length < 8) {
      appAlert('Şifre çok kısa', 'Yeni şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (newPassword !== newPasswordAgain) {
      appAlert('Şifreler eşleşmiyor', 'Yeni şifre ve tekrarı aynı olmalıdır.');
      return;
    }

    setSavingPassword(true);
    try {
      await completeInitialPassword(newPassword, newPasswordAgain);
      setPasswordSetupVisible(false);
      setNewPassword('');
      setNewPasswordAgain('');
      appAlert('Şifreniz oluşturuldu', 'Çalışkan B2B hesabınız kullanıma hazır.');
      router.replace('/(tabs)');
    } catch (error) {
      appAlert(
        'Şifre oluşturulamadı',
        error instanceof Error ? error.message : 'Lütfen tekrar deneyin.',
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.back} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          <Text style={styles.backText}>Mağazaya dön</Text>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.brandRow}>
            <Image
              source={
                branding.b2b_mobile_logo
                  ? { uri: branding.b2b_mobile_logo }
                  : require('../assets/logo.png')
              }
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.customerLabel}>Müşteri Girişi</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.title}>İşletme hesabınıza giriş yapın</Text>
            <Text style={styles.subtitle}>
              Web sitesinde kullandığınız Çalışkan B2B hesabı mobil uygulamada da aynıdır.
            </Text>

            <FormField
              label="E-posta"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="ornek@firma.com"
            />

            <FormField
              label="Şifre"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              rightSlot={
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((current) => !current)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              }
            />

            <Pressable
              style={[styles.primaryButton, submitting && styles.disabled]}
              onPress={handleLogin}
              disabled={submitting}
            >
              <Ionicons name="log-in-outline" size={19} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                {submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push('/signup')}
            >
              <Ionicons name="person-add-outline" size={19} color={colors.text} />
              <Text style={styles.secondaryButtonText}>Firma Hesabı Aç</Text>
            </Pressable>

            <Pressable
              style={styles.quickEntry}
              onPress={() => router.replace('/(tabs)')}
            >
              <Ionicons name="storefront-outline" size={19} color={colors.textSecondary} />
              <View style={styles.quickText}>
                <Text style={styles.quickTitle}>Üyelik olmadan ürünleri incele</Text>
                <Text style={styles.quickSubtitle}>
                  Fiyatlar giriş yaptıktan sonra görüntülenir.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <Pressable
              style={styles.helpButton}
              onPress={async () => {
                if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
                  appAlert(
                    'E-posta gerekli',
                    'Şifre yenileme için hesabınıza ait e-posta adresini giriş alanına yazın.',
                  );
                  return;
                }

                try {
                  const result = await forgotPassword(email);
                  appAlert(
                    'Şifre yenileme',
                    result.message ||
                      'Hesap uygunsa yeni tek kullanımlık şifre e-posta adresinize gönderildi.',
                  );
                } catch (error) {
                  appAlert(
                    'Şifre yenilenemedi',
                    error instanceof Error
                      ? error.message
                      : 'Lütfen daha sonra tekrar deneyin.',
                  );
                }
              }}
            >
              <Ionicons name="key-outline" size={18} color={colors.textMuted} />
              <Text style={styles.helpText}>Şifremi Unuttum</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={passwordSetupVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => undefined}
      >
        <KeyboardAvoidingView
          style={styles.modalScreen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalIcon}>
              <Ionicons name="key-outline" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.modalTitle}>Yeni şifrenizi oluşturun</Text>
            <Text style={styles.modalSubtitle}>
              Yönetici onayından sonra gönderilen tek kullanımlık şifre yalnızca ilk giriş içindir.
              Devam etmek için en az 8 karakterli kalıcı şifrenizi belirleyin.
            </Text>

            <FormField
              label="Yeni Şifre"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              placeholder="En az 8 karakter"
              rightSlot={
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowNewPassword((current) => !current)}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              }
            />

            <FormField
              label="Yeni Şifre Tekrar"
              value={newPasswordAgain}
              onChangeText={setNewPasswordAgain}
              secureTextEntry={!showNewPassword}
              placeholder="Şifrenizi tekrar girin"
            />

            <Pressable
              style={[styles.primaryButton, savingPassword && styles.disabled]}
              onPress={saveInitialPassword}
              disabled={savingPassword}
            >
              <Ionicons name="checkmark-circle-outline" size={19} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                {savingPassword ? 'Kaydediliyor…' : 'Şifremi Oluştur'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  back: {
    minHeight: minTouchTarget,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  card: {
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  brandRow: {
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 150,
    height: 44,
  },
  customerLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  form: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontWeight: '900',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    top: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '800',
  },
  quickEntry: {
    minHeight: 70,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  quickText: {
    flex: 1,
  },
  quickTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '700',
  },
  quickSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  helpButton: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  helpText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  disabled: {
    opacity: 0.6,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContent: {
    flexGrow: 1,
    padding: spacing.xxl,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    ...typography.largeTitle,
    color: colors.text,
    fontWeight: '900',
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
