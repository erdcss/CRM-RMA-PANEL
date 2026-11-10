import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAppearance } from '@/contexts/AppearanceContext';
import { getMetaEventsConsent, setMetaEventsConsent } from '@/lib/meta-app-events';
import { getTikTokAppEventsConsent, isTikTokAppEventsConfigured, setTikTokAppEventsConsent } from '@/lib/tiktok-app-events';

/**
 * Privacy controls remain accessible when technical advertising measurement
 * and diagnostic options are removed from customer-facing Settings.
 * Never turn on a provider automatically or combine separate opt-ins.
 */
export default function PrivacyPreferencesScreen() {
  const router = useRouter();
  const { palette } = useAppearance();
  const [metaConsent, setMetaConsent] = useState<boolean | null>(null);
  const [tiktokConsent, setTiktokConsent] = useState<boolean | null>(null);
  const [tiktokAvailable, setTiktokAvailable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      getMetaEventsConsent(),
      getTikTokAppEventsConsent(),
      isTikTokAppEventsConfigured(),
    ]).then(([meta, tiktok, available]) => {
      if (!mounted) return;
      setMetaConsent(meta);
      setTiktokConsent(tiktok);
      setTiktokAvailable(available);
    }).catch(() => {
      if (mounted) {
        setMetaConsent(false);
        setTiktokConsent(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const changeMetaConsent = async () => {
    if (metaConsent === null || saving) return;
    const previous = metaConsent;
    setMetaConsent(!previous);
    setSaving(true);
    try {
      await setMetaEventsConsent(!previous);
    } catch {
      setMetaConsent(previous);
      Alert.alert('Tercih kaydedilemedi', 'Gizlilik tercihinizi güncelleyemedik. Tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  const changeTikTokConsent = async () => {
    if (tiktokConsent === null || saving || (!tiktokAvailable && !tiktokConsent)) return;
    const previous = tiktokConsent;
    setTiktokConsent(!previous);
    setSaving(true);
    try {
      const accepted = await setTikTokAppEventsConsent(!previous);
      if (!accepted) {
        setTiktokConsent(previous);
        Alert.alert('Tercih kaydedilemedi', 'Bu sürümde isteğe bağlı ölçüm izni etkinleştirilemiyor.');
      }
    } catch {
      setTiktokConsent(previous);
      Alert.alert('Tercih kaydedilemedi', 'Gizlilik tercihinizi güncelleyemedik. Tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  return <Screen style={{ backgroundColor: palette.background }}>
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Geri dön">
          <Ionicons name="chevron-back" size={25} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>Gizlilik ve Veri Tercihleri</Text>
        <View style={styles.back} />
      </View>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.heading, { color: palette.text }]}>İsteğe bağlı reklam ve analiz izinleri</Text>
        <Text style={[styles.caption, { color: palette.textSecondary }]}>
          Uygulama kullanım olaylarının reklam ve hizmet ölçümü amacıyla paylaşılmasına
          izin verip vermeyeceğinizi buradan seçebilirsiniz. İzin vermeseniz de
          uygulamayı kullanabilirsiniz. Tercihinizi her zaman değiştirebilirsiniz.
        </Text>

        {(Platform.OS === 'ios' || metaConsent === true) ? (
          <Pressable accessibilityRole="switch"
            accessibilityLabel="Meta ile isteğe bağlı kullanım ölçümüne izin ver"
            accessibilityState={{ checked: metaConsent === true, disabled: metaConsent === null || saving }}
            disabled={metaConsent === null || saving}
            onPress={() => { void changeMetaConsent(); }}
            style={[styles.action, { borderTopColor: palette.border }]}>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: palette.text }]}>Meta ile isteğe bağlı kullanım ölçümü</Text>
              <Text style={[styles.caption, { color: palette.textSecondary }]}>
                Facebook ve Instagram reklam performansının ölçümü için onay.
              </Text>
            </View>
            <Ionicons name={metaConsent ? 'toggle' : 'toggle-outline'} size={34}
              color={metaConsent ? '#FFCD00' : palette.muted} />
          </Pressable>
        ) : null}

        {(tiktokAvailable || tiktokConsent === true) ? (
          <Pressable accessibilityRole="switch"
            accessibilityLabel="TikTok ile isteğe bağlı reklam ölçümüne izin ver"
            accessibilityState={{
              checked: tiktokConsent === true,
              disabled: tiktokConsent === null || saving || (!tiktokAvailable && !tiktokConsent),
            }}
            disabled={tiktokConsent === null || saving || (!tiktokAvailable && !tiktokConsent)}
            onPress={() => { void changeTikTokConsent(); }}
            style={[styles.action, { borderTopColor: palette.border }]}>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: palette.text }]}>TikTok ile isteğe bağlı reklam ölçümü</Text>
              <Text style={[styles.caption, { color: palette.textSecondary }]}>
                TikTok reklam performansının ölçümü için ayrı onay.
              </Text>
            </View>
            <Ionicons name={tiktokConsent ? 'toggle' : 'toggle-outline'} size={34}
              color={tiktokConsent ? '#FFCD00' : palette.muted} />
          </Pressable>
        ) : null}
        <Text style={[styles.caption, { color: palette.textSecondary, marginTop: 12 }]}>
          Bu izinler birbirinden bağımsızdır ve varsayılan olarak kapalıdır.
          Ad, telefon, vergi numarası ve ödeme detayları isteğe bağlı uygulama olaylarına eklenmez.
          Hizmet sağlayıcılar teknik cihaz ve bağlantı verilerini işleyebilir.
        </Text>
      </View>
      {Platform.OS === 'ios' ? (
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border, marginTop: 14 }]}>
          <Pressable accessibilityRole="button"
            accessibilityLabel="Cihazın gizlilik ayarlarını aç"
            onPress={() => { void Linking.openSettings(); }}
            style={styles.settingsButton}>
            <Ionicons name="shield-checkmark-outline" size={22} color={palette.text} />
            <Text style={[styles.actionTitle, { color: palette.text, flex: 1 }]}>Cihazın gizlilik ayarları</Text>
            <Ionicons name="chevron-forward" size={20} color={palette.muted} />
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 17, paddingTop: 10, paddingBottom: 80 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 53, marginBottom: 20 },
  back: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '900', flex: 1, textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: 20, padding: 16 },
  heading: { fontSize: 17, fontWeight: '900', marginBottom: 9 },
  caption: { fontSize: 12, lineHeight: 19 },
  action: { minHeight: 75, flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 14, marginTop: 15, borderTopWidth: 1 },
  actionCopy: { flex: 1, gap: 4 },
  actionTitle: { fontSize: 14, fontWeight: '700' },
  settingsButton: { flexDirection: 'row', gap: 13, alignItems: 'center', minHeight: 50 },
});
