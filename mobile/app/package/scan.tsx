import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/ui/AppHeader';
import { Screen } from '@/components/ui/Screen';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { rmaApi } from '@/lib/api';

export default function PackageScanScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async (value?: string) => {
    const q = (value ?? code).trim();
    if (!q) return;
    setLoading(true);
    try {
      const pkg = await rmaApi.lookupPackage(q);
      router.push(`/package/${pkg.id}`);
    } catch (err) {
      Alert.alert('Koli bulunamadi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Koli Tara" onBack={() => router.back()} />
      <View style={styles.body}>
        <Text style={styles.hint}>Koli numarasi, barkod veya QR kodu girin.</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="Barkod / koli no"
          autoCapitalize="characters"
          autoCorrect={false}
          onSubmitEditing={() => lookup()}
          editable={!loading}
        />
        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => lookup()}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Araniyor...' : 'Koli Bul'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md },
  hint: { ...typography.body, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    minHeight: minTouchTarget,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
