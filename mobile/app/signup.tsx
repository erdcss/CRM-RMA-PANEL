import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Eksik bilgi', 'E-posta ve şifre girin.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Zayıf şifre', 'Şifre en az 6 karakter olmalıdır.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Şifre uyuşmuyor', 'Şifre tekrarı eşleşmiyor.');
      return;
    }

    setSubmitting(true);
    try {
      await signUp(email, password);
      Alert.alert('Kayıt başarılı', 'Hesabınız oluşturuldu. Giriş yapabilirsiniz.');
    } catch (error) {
      Alert.alert(
        'Kayıt başarısız',
        error instanceof Error ? error.message : 'Hesap oluşturulamadı.',
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

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>{submitting ? 'Kaydediliyor…' : 'Hesap Oluştur'}</Text>
          </Pressable>

          <Pressable style={styles.linkButton} onPress={() => router.push('/login' as never)}>
            <Text style={styles.linkText}>Zaten hesabınız var mı? Giriş yapın</Text>
          </Pressable>
        </View>
      </ScrollView>
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
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  backText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  logoImage: {
    width: 96,
    height: 96,
  },
  title: {
    ...typography.largeTitle,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    gap: spacing.lg,
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
  button: {
    marginTop: spacing.sm,
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: colors.surface,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  linkText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
});
