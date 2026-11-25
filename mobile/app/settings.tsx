import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Screen } from '@/components/ui/Screen';
import { useAppearance } from '@/contexts/AppearanceContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { palette } = useAppearance();
  const appVersion = Constants.expoConfig?.version || '1.0.1';
  return <Screen edges={['top', 'bottom']} style={{ backgroundColor: palette.background }}>
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Geri dön">
          <Ionicons name="chevron-back" size={25} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>Ayarlar</Text>
        <View style={styles.back} />
      </View>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
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
      <Text style={[styles.version, { color: palette.textSecondary }]}>Çalışkan B2B sürümü {appVersion}</Text>
    </ScrollView>
  </Screen>;
}
const styles=StyleSheet.create({
  page:{ flexGrow:1,paddingHorizontal:17,paddingTop:10,paddingBottom:24 },
  header:{ flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:53,marginBottom:20 },
  back:{ width:42,height:42,alignItems:'center',justifyContent:'center' },
  title:{ fontSize:19,fontWeight:'900' },
  card:{ borderWidth:1,borderRadius:20,padding:15 },
  action:{ minHeight:60,flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:7 },
  actionText:{ flex:1,fontSize:14,fontWeight:'600' },
  version:{ marginTop:'auto',paddingTop:24,textAlign:'center',fontSize:12,fontWeight:'300',fontStyle:'italic' },
});
