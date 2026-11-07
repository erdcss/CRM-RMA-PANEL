import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type ThemePreference } from '@/contexts/AppearanceContext';
import { getMetaEventsConsent, setMetaEventsConsent } from '@/lib/meta-app-events';

const choices: Array<{ mode: ThemePreference; label: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { mode: 'dark', label: 'Koyu Tema', subtitle: 'Karanlık arayüz', icon: 'moon-outline' },
  { mode: 'light', label: 'Açık Tema', subtitle: 'Aydınlık arayüz', icon: 'sunny-outline' },
  { mode: 'system', label: 'Sistem Varsayılanı', subtitle: 'Cihazınızın görünümüne uyum sağlar', icon: 'phone-portrait-outline' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { palette, preference, setPreference } = useAppearance();
  const [metaConsent, setMetaConsent] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    void getMetaEventsConsent().then(value => { if (mounted) setMetaConsent(value); });
    return () => { mounted = false; };
  }, []);
  const updateMetaConsent = () => {
    if (metaConsent === null) return;
    const previous = metaConsent;
    const next = !previous;
    setMetaConsent(next);
    void setMetaEventsConsent(next).catch(() => setMetaConsent(previous));
  };
  const sourceRevision = String(Constants.expoConfig?.extra?.sourceRevision || 'Eski / doğrulanmamış build');
  const buildDate = Constants.expoConfig?.extra?.sourceBuildDate;
  const appVersion = Constants.expoConfig?.version || '1.0.1';
  return <Screen style={{ backgroundColor: palette.background }}>
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Geri dön">
          <Ionicons name="chevron-back" size={25} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>Ayarlar</Text>
        <View style={styles.back} />
      </View>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.heading, { color: palette.text }]}>Tema Seçimi</Text>
        <Text style={[styles.caption, { color: palette.textSecondary }]}>Uygulamanın görünümünü kişiselleştirin.</Text>
        {choices.map(item => <Pressable
          key={item.mode}
          onPress={() => setPreference(item.mode)}
          accessibilityRole="radio"
          accessibilityState={{ checked: preference === item.mode }}
          style={[styles.option, { borderColor: preference === item.mode ? '#E9B600' : palette.border, backgroundColor: palette.surfaceSecondary }]}
        >
          <View style={[styles.icon, { backgroundColor: preference === item.mode ? '#FFCD00' : palette.surface }]}>
            <Ionicons name={item.icon} size={23} color={preference === item.mode ? '#131313' : palette.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionTitle, { color: palette.text }]}>{item.label}</Text>
            <Text style={[styles.caption, { color: palette.textSecondary }]}>{item.subtitle}</Text>
          </View>
          <Ionicons name={preference === item.mode ? 'radio-button-on' : 'radio-button-off'} size={23} color={preference === item.mode ? '#E9B600' : palette.muted} />
        </Pressable>)}
      </View>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border, marginTop: 15 }]}>
        <Text style={[styles.heading, { color: palette.text }]}>Gizlilik ve Ölçümleme</Text>
        <Text style={[styles.caption, { color: palette.textSecondary }]}>
          İzin verirseniz yalnızca uygulama kullanım olayları Meta ile paylaşılır.
          Kimlik ve ödeme bilgileri paylaşılmaz. Bu seçeneği istediğiniz zaman kapatabilirsiniz.
        </Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Meta uygulama olayları ölçüm izni"
          accessibilityState={{ checked: metaConsent === true, disabled: metaConsent === null }}
          disabled={metaConsent === null}
          onPress={updateMetaConsent}
          style={[styles.action, { marginTop: 10 }]}
        >
          <Ionicons name="analytics-outline" size={20} color={palette.text} />
          <Text style={[styles.actionText, { color: palette.text }]}>Reklam ölçümüne izin ver</Text>
          <Ionicons name={metaConsent ? 'toggle' : 'toggle-outline'} size={32} color={metaConsent ? '#FFCD00' : palette.muted} />
        </Pressable>
      </View>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border, marginTop: 15 }]}>
        <Text style={[styles.heading, { color: palette.text }]}>Uygulama Sürümü</Text>
        <Text style={[styles.caption, { color: palette.textSecondary, marginTop: 6 }]}>Çalışkan B2B · {appVersion}</Text>
        <Text selectable style={[styles.caption, { color: palette.textSecondary, marginTop: 4 }]}>Kod sürümü: {sourceRevision}</Text>
        {typeof buildDate === 'string' ? <Text style={[styles.caption, { color: palette.textSecondary, marginTop: 4 }]}>Derleme tarihi: {buildDate.slice(0, 16).replace('T', ' ')}</Text> : null}
      </View>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border, marginTop: 15 }]}>
        <Pressable style={styles.action} onPress={() => void Linking.openURL('https://b2b.ecalisgan.com/destek')}>
          <Ionicons name="headset-outline" size={20} color={palette.text} />
          <Text style={[styles.actionText, { color: palette.text }]}>Yardım Merkezi</Text>
          <Ionicons name="chevron-forward" size={18} color={palette.muted} />
        </Pressable>
        <Pressable style={styles.action} onPress={() => void Linking.openURL('https://b2b.ecalisgan.com')}>
          <Ionicons name="information-circle-outline" size={20} color={palette.text} />
          <Text style={[styles.actionText, { color: palette.text }]}>Çalışkan B2B Hakkında</Text>
          <Ionicons name="chevron-forward" size={18} color={palette.muted} />
        </Pressable>
      </View>
    </ScrollView>
  </Screen>;
}
const styles=StyleSheet.create({
  page:{ paddingHorizontal:17,paddingTop:10,paddingBottom:90 },
  header:{ flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:53,marginBottom:20 },
  back:{ width:42,height:42,alignItems:'center',justifyContent:'center' },
  title:{ fontSize:19,fontWeight:'900' },
  card:{ borderWidth:1,borderRadius:20,padding:15 },
  heading:{ fontSize:18,fontWeight:'900',marginBottom:5 },
  caption:{ fontSize:12,lineHeight:19 },
  option:{ minHeight:85,borderWidth:1,borderRadius:13,flexDirection:'row',alignItems:'center',gap:12,padding:12,marginTop:11 },
  icon:{ width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center' },
  optionTitle:{ fontSize:15,fontWeight:'800',marginBottom:3 },
  action:{ minHeight:60,flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:7 },
  actionText:{ flex:1,fontSize:14,fontWeight:'600' },
});
