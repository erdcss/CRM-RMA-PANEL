import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.mainContent}>
          <View style={styles.hero}>
            <Image source={require('../assets/logo.png')} style={styles.logoImage} contentFit="contain" />
            <Text style={styles.title}>Çalışkan RMA</Text>
            <Text style={styles.subtitle}>Operasyon paneline giriş yapın</Text>
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

            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={submitting}
            >
              <Text style={styles.buttonText}>{submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}</Text>
            </Pressable>

            <Pressable style={styles.linkButton} onPress={() => router.push('/signup' as never)}>
              <Text style={styles.linkText}>Hesabınız yok mu? Kaydol</Text>
            </Pressable>
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