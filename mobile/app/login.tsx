import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Animated,
} from 'react-native';
import { appAlert } from '@/lib/appAlert';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { FormField } from '@/components/forms/FormField';
import { useAuth } from '@/contexts/AuthContext';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const signupAnim = useRef(new Animated.Value(0)).current;
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      appAlert('Eksik bilgi', 'E-posta ve şifre girin.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (error) {
      appAlert(
        'Giriş başarısız',
        error instanceof Error ? error.message : 'E-posta veya şifre hatalı.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSignup = () => {
    const next = !signupOpen;
    setSignupOpen(next);
    Animated.timing(signupAnim, { toValue: next ? 1 : 0, duration: 280, useNativeDriver: false }).start();
  };

  const goToSignup = () => {
    router.push({
      pathname: '/signup',
      params: { companyName, fullName, city, district, phone, businessCategory },
    } as never);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.mainContent}>
          <View style={styles.hero}>
            <Image source={require('../assets/logo.png')} style={styles.logoImage} contentFit="contain" />
            <Text style={styles.title}>Çalışkan B2B</Text>
            <Text style={styles.subtitle}>Toptan satın alma hesabınıza giriş yapın</Text>
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
              placeholder="••••••••"
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

            <Pressable style={styles.forgotButton} onPress={() => appAlert('Şifremi Unuttum', 'Şifre sıfırlama bağlantısı e-posta adresinize gönderilecektir.')}>
              <Text style={styles.forgotText}>Şifremi Unuttum</Text>
            </Pressable>

            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={submitting}
            >
              <Text style={styles.buttonText}>{submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}</Text>
            </Pressable>

            <Pressable style={styles.signupToggle} onPress={toggleSignup}>
              <Text style={styles.linkText}>{signupOpen ? 'Üyelik Formunu Kapat' : 'Hemen Üye Ol'}</Text>
              <Ionicons name={signupOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
            </Pressable>

            <Animated.View style={[styles.signupPanel, {
              maxHeight: signupAnim.interpolate({ inputRange:[0,1], outputRange:[0,620] }),
              opacity: signupAnim,
            }]}>
              <View style={styles.signupFields}>
                <Text style={styles.signupTitle}>Toptan Satış Üyeliği</Text>
                <Text style={styles.signupDescription}>Firmanıza ait bilgileri girerek Çalışkan B2B üyeliğinizi oluşturun.</Text>
                <FormField label="Firma İsmi" value={companyName} onChangeText={setCompanyName} placeholder="Firma ünvanı" />
                <FormField label="İsim Soy İsim" value={fullName} onChangeText={setFullName} placeholder="Ad Soyad" />
                <View style={styles.row}>
                  <View style={styles.rowField}><FormField label="İl" value={city} onChangeText={setCity} placeholder="İstanbul" /></View>
                  <View style={styles.rowField}><FormField label="İlçe" value={district} onChangeText={setDistrict} placeholder="İlçe" /></View>
                </View>
                <FormField label="Telefon Numarası" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="05xx xxx xx xx" />
                <FormField label="İşletme Kategorisi" value={businessCategory} onChangeText={setBusinessCategory} placeholder="Elektronik, market, yapı market..." />
                <Pressable style={styles.outlineButton} onPress={goToSignup}>
                  <Text style={styles.outlineButtonText}>Üyeliğe Devam Et</Text>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </View>

        <View style={styles.poweredBy}>
          <Text style={styles.poweredByText}>POWERED BY Orvian</Text>
        </View>
      </ScrollView>
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
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl},
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xxl},
  hero: {
    alignItems: 'center',
    gap: spacing.sm},
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: spacing.sm},
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
    color: colors.surface},
  forgotButton: { alignItems:'flex-end', paddingVertical: spacing.xs },
  forgotText: { ...typography.bodyMedium, color: colors.primary },
  signupToggle: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap: spacing.xs, paddingVertical: spacing.sm },
  signupPanel: { overflow:'hidden' },
  signupFields: { gap: spacing.md, paddingTop: spacing.sm },
  signupTitle: { ...typography.title, color: colors.text },
  signupDescription: { ...typography.body, color: colors.textSecondary },
  row: { flexDirection:'row', gap: spacing.md },
  rowField: { flex:1 },
  outlineButton: { minHeight:minTouchTarget, borderRadius:radius.md, borderWidth:1, borderColor:colors.primary, alignItems:'center', justifyContent:'center', marginTop:spacing.sm },
  outlineButtonText: { ...typography.bodyMedium, color:colors.primary },
  linkButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm},
  linkText: {
    ...typography.bodyMedium,
    color: colors.primary},
  poweredBy: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm},
  poweredByText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 2,
    color: colors.textMuted}});