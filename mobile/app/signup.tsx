import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View} from 'react-native';
import { appAlert } from '@/lib/appAlert';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { FormField } from '@/components/forms/FormField';
import { useAuth } from '@/contexts/AuthContext';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

const PRIVACY_URL = 'https://crm-rma.up.railway.app/privacy';
const TERMS_VERSION = '18.08.2026';

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreementVisible, setAgreementVisible] = useState(false);

  const validateForm = () => {
    if (!email.trim() || !password) {
      appAlert('Eksik bilgi', 'E-posta ve şifre girin.');
      return false;
    }

    if (password.length < 6) {
      appAlert('Zayıf şifre', 'Şifre en az 6 karakter olmalıdır.');
      return false;
    }

    if (password !== confirmPassword) {
      appAlert('Şifre uyuşmuyor', 'Şifre tekrarı eşleşmiyor.');
      return false;
    }

    return true;
  };

  const handleSignup = () => {
    if (!validateForm()) return;
    setAgreementVisible(true);
  };

  const confirmAgreementAndSignup = async () => {
    setSubmitting(true);
    try {
      await signUp(email, password);
      setAgreementVisible(false);
      appAlert('Kayıt başarılı', 'Hesabınız oluşturuldu. Giriş yapabilirsiniz.');
    } catch (error) {
      appAlert(
        'Kayıt başarısız',
        error instanceof Error ? error.message : 'Hesap oluşturulamadı.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openPrivacyPolicy = async () => {
    try {
      await Linking.openURL(PRIVACY_URL);
    } catch {
      appAlert('Bağlantı açılamadı', 'Gizlilik Politikası ve KVKK metni açılamadı.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backText}>Giriş</Text>
        </Pressable>

        <View style={styles.hero}>
          <Image source={require('../assets/logo.png')} style={styles.logoImage} contentFit="contain" />
          <Text style={styles.title}>Kaydol</Text>
          <Text style={styles.subtitle}>Kişisel Çalışkan RMA hesabınızı oluşturun</Text>
        </View>

        <View style={styles.form}>
          <FormField
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ornek@caliskangroup.com"
          />
          <FormField
            label="Şifre"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholder="En az 6 karakter"
            rightSlot={
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            }
          />
          <FormField
            label="Şifre Tekrar"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            placeholder="Şifrenizi tekrar girin"
          />

          <View style={styles.agreementNotice}>
            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            <Text style={styles.agreementNoticeText}>
              Hesap oluşturmadan önce Kullanıcı Sözleşmesi'ni okuyup onaylamanız gerekir.
            </Text>
          </View>

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>{submitting ? 'Kaydediliyor…' : 'Sözleşmeyi Oku ve Devam Et'}</Text>
          </Pressable>

          <Pressable style={styles.linkButton} onPress={() => router.push('/login' as never)}>
            <Text style={styles.linkText}>Zaten hesabınız var mı? Giriş yapın</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={agreementVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !submitting && setAgreementVisible(false)}
      >
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>Kullanıcı Sözleşmesi</Text>
              <Text style={styles.modalVersion}>Sürüm: {TERMS_VERSION}</Text>
            </View>
            <Pressable
              style={styles.modalClose}
              onPress={() => setAgreementVisible(false)}
              disabled={submitting}
              accessibilityLabel="Sözleşmeyi kapat"
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.termsScroll} contentContainerStyle={styles.termsContent}>
            <Text style={styles.termsLead}>
              Bu sözleşme, Çalışkan RMA uygulamasına hesap oluşturan kullanıcı ile hizmet sağlayıcı arasındaki uygulama kullanım koşullarını düzenler.
            </Text>

            <Text style={styles.termsHeading}>1. Hizmetin kapsamı</Text>
            <Text style={styles.termsText}>
              Çalışkan RMA; RMA, iade, değişim, servis, müşteri, ürün ve ilgili operasyon kayıtlarının yönetilmesine yardımcı olan bir yazılım hizmetidir. Kullanıcı, uygulamayı yalnızca hukuka ve kullanım amacına uygun şekilde kullanmayı kabul eder.
            </Text>

            <Text style={styles.termsHeading}>2. Hesap ve güvenlik</Text>
            <Text style={styles.termsText}>
              Kullanıcı, kayıt sırasında verdiği bilgilerin doğruluğundan ve hesabının güvenliğinden sorumludur. Şifre ve giriş bilgileri üçüncü kişilerle paylaşılmamalıdır. Yetkisiz kullanım fark edildiğinde gerekli güvenlik önlemleri alınmalıdır.
            </Text>

            <Text style={styles.termsHeading}>3. Kullanıcı tarafından girilen veriler</Text>
            <Text style={styles.termsText}>
              Uygulamaya girilen müşteri, ürün, servis ve diğer iş kayıtlarının hukuka uygun olarak elde edilmesi ve sisteme aktarılması kullanıcının sorumluluğundadır. Kullanıcı, yetkisi bulunmayan veya hukuka aykırı içerikleri sisteme yüklememelidir.
            </Text>

            <Text style={styles.termsHeading}>4. Kişisel veriler ve gizlilik</Text>
            <Text style={styles.termsText}>
              Kişisel verilerin işlenmesine ilişkin bilgilendirme, Kullanıcı Sözleşmesi'nden ayrı olarak Gizlilik Politikası ve KVKK Aydınlatma Metni'nde yer alır. Bu metni ayrıca inceleyebilirsiniz.
            </Text>
            <Pressable style={styles.privacyButton} onPress={openPrivacyPolicy}>
              <Text style={styles.privacyButtonText}>Gizlilik Politikası ve KVKK Metnini Aç</Text>
              <Ionicons name="open-outline" size={18} color={colors.primary} />
            </Pressable>

            <Text style={styles.termsHeading}>5. Hizmetin kullanılabilirliği</Text>
            <Text style={styles.termsText}>
              Güvenlik, bakım, güncelleme veya teknik nedenlerle hizmette geçici kesintiler ya da değişiklikler olabilir. Hizmetin güvenli ve sürdürülebilir biçimde devamı için uygulama özellikleri güncellenebilir.
            </Text>

            <Text style={styles.termsHeading}>6. Hesabın sona erdirilmesi</Text>
            <Text style={styles.termsText}>
              Kullanıcı uygulamadaki hesap silme özelliğini kullanarak hesabının kapatılmasını talep edebilir. Hukuka aykırı kullanım, güvenlik ihlali veya sözleşmeye esaslı aykırılık halinde hesabın kullanımı sınırlandırılabilir veya sonlandırılabilir.
            </Text>

            <Text style={styles.termsHeading}>7. Fikri mülkiyet</Text>
            <Text style={styles.termsText}>
              Çalışkan RMA'nın yazılımı, tasarımı, markası ve hizmete ait diğer fikri unsurlar üzerindeki haklar ilgili hak sahiplerine aittir. Kullanıcıya yalnızca hizmetten yararlanmak amacıyla sınırlı kullanım hakkı verilir.
            </Text>

            <Text style={styles.termsHeading}>8. Sözleşme değişiklikleri</Text>
            <Text style={styles.termsText}>
              Kullanım koşullarında önemli bir değişiklik yapılması halinde güncel metin uygulama içinde veya uygun bir iletişim kanalıyla kullanıcıya sunulabilir. Güncel sözleşme sürümü bu ekranda gösterilir.
            </Text>

            <Text style={styles.termsHeading}>9. İletişim</Text>
            <Text style={styles.termsText}>
              Sözleşme, hesap veya kişisel verilerle ilgili talepler için erdemcls94@gmail.com adresinden iletişim kurulabilir.
            </Text>

            <Text style={styles.termsFootnote}>
              “Okudum ve Onaylıyorum” düğmesine bastığınızda bu Kullanıcı Sözleşmesi'ni kabul ederek hesap oluşturma işlemini tamamlarsınız.
            </Text>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              style={[styles.confirmButton, submitting && styles.buttonDisabled]}
              onPress={confirmAgreementAndSignup}
              disabled={submitting}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.surface} />
              <Text style={styles.buttonText}>
                {submitting ? 'Hesap oluşturuluyor…' : 'Okudum ve Onaylıyorum'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background},
  content: {
    flexGrow: 1,
    padding: spacing.xxl,
    paddingTop: spacing.xxxl + spacing.xl,
    gap: spacing.xl},
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.xs},
  backText: {
    ...typography.bodyMedium,
    color: colors.text},
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm},
  logoImage: {
    width: 96,
    height: 96},
  title: {
    ...typography.largeTitle,
    color: colors.text},
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center'},
  form: {
    gap: spacing.lg},
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    top: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'},
  agreementNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface},
  agreementNoticeText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1},
  button: {
    marginTop: spacing.sm,
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'},
  buttonDisabled: {
    opacity: 0.7},
  buttonText: {
    ...typography.bodyMedium,
    color: colors.surface,
    textAlign: 'center'},
  linkButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm},
  linkText: {
    ...typography.bodyMedium,
    color: colors.primary},
  modalScreen: {
    flex: 1,
    backgroundColor: colors.background},
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface},
  modalHeaderText: {
    flex: 1},
  modalTitle: {
    ...typography.title,
    color: colors.text},
  modalVersion: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2},
  modalClose: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center'},
  termsScroll: {
    flex: 1},
  termsContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl},
  termsLead: {
    ...typography.bodyMedium,
    color: colors.text,
    lineHeight: 23,
    marginBottom: spacing.lg},
  termsHeading: {
    ...typography.bodyMedium,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm},
  termsText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22},
  privacyButton: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary},
  privacyButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
    flex: 1},
  termsFootnote: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.xl},
  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface},
  confirmButton: {
    minHeight: minTouchTarget + 4,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg}});