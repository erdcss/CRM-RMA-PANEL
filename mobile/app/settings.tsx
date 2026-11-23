import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type ThemePreference } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { appAlert } from '@/lib/appAlert';
import { getStoreNearbyPermissionStatus, requestStoreNearbyOptIn, revokeStoreNearby } from '@/lib/store-geofence';

const choices: Array<{ mode: ThemePreference; label: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { mode: 'dark', label: 'Koyu Tema', subtitle: 'Karanlık arayüz', icon: 'moon-outline' },
  { mode: 'light', label: 'Açık Tema', subtitle: 'Aydınlık arayüz', icon: 'sunny-outline' },
  { mode: 'system', label: 'Sistem Varsayılanı', subtitle: 'Cihazınızın görünümüne uyum sağlar', icon: 'phone-portrait-outline' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { palette, preference, setPreference } = useAppearance();
  const { user } = useAuth();
  const [nearbyStatus, setNearbyStatus] = useState({consented:false,ready:false});
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const refreshNearby = useCallback(async () => {
    if (Platform.OS !== 'ios' || !user?.id) return;
    try {setNearbyStatus(await getStoreNearbyPermissionStatus(String(user.id)));}
    catch(error){console.warn('[store-geofence] settings status:',error);}
  },[user?.id]);
  useFocusEffect(useCallback(()=>{
    void refreshNearby();
  },[refreshNearby]));
  const changeNearby = async () => {
    if (!user?.id || nearbyBusy) return;
    setNearbyBusy(true);
    try {
      if (nearbyStatus.consented) {
        await revokeStoreNearby(String(user.id));
      } else {
        await requestStoreNearbyOptIn(String(user.id));
      }
    } catch(error) {
      console.warn('[store-geofence] settings:',error);
      appAlert('Konum tercihi kaydedilemedi','İzinlerinizi kontrol edip yeniden deneyin.');
    } finally { await refreshNearby(); setNearbyBusy(false); }
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
        <Pressable accessibilityRole="button" accessibilityLabel="Gizlilik ve Veri Tercihleri"
          style={styles.action} onPress={() => router.push('/privacy-preferences')}>
          <Ionicons name="shield-checkmark-outline" size={22} color={palette.text} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionText, { color: palette.text }]}>Gizlilik ve Veri Tercihleri</Text>
            <Text style={[styles.caption, { color: palette.textSecondary, marginTop: 3 }]}>
              İsteğe bağlı veri paylaşımı izinlerini yönetin.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.muted} />
        </Pressable>
      </View>
      {Platform.OS === 'ios' && user?.id ? (
        <View style={[styles.card, {backgroundColor:palette.surface,borderColor:palette.border,marginTop:15}]}>
          <Text style={[styles.heading,{color:palette.text}]}>Mağaza yakınlık bildirimleri</Text>
          <Text style={[styles.caption,{color:palette.textSecondary}]}>
            {nearbyStatus.ready
              ? 'Konum ve bildirim izinleri açık. İSTOÇ mağazamıza yaklaştığınızda, kampanya aktifse günde en fazla bir hatırlatma alabilirsiniz.'
              : nearbyStatus.consented
                ? 'Yakınlık hatırlatmalarına onay verdiniz ancak bir cihaz izni kapalı. iPhone Ayarları üzerinden Konum: Her Zaman ve bildirim izinlerini kontrol edin.'
                : 'İsteğe bağlıdır. Mağaza yakınlık hatırlatmaları için uygulama kapalıyken konum izni gerekebilir. İzin isteme işlemi ilk girişte yapılır; tercihinizi buradan değiştirebilirsiniz.'}
          </Text>
          <Pressable accessibilityRole="button" disabled={nearbyBusy}
            onPress={()=>{void changeNearby();}}
            style={[styles.locationAction,{backgroundColor:nearbyStatus.consented?palette.surfaceSecondary:palette.accent,opacity:nearbyBusy?0.6:1}]}>
            <Ionicons name={nearbyStatus.consented?'location-outline':'location-sharp'}
              size={19} color={nearbyStatus.consented?palette.text:'#171717'}/>
            <Text style={[styles.locationActionText,{color:nearbyStatus.consented?palette.text:'#171717'}]}>
              {nearbyBusy?'Kaydediliyor...':nearbyStatus.consented?'Yakınlık hatırlatmalarını kapat':'Yakınlık hatırlatmalarını etkinleştir'}
            </Text>
          </Pressable>
          {nearbyStatus.consented && !nearbyStatus.ready ? (
            <Pressable accessibilityRole="button" onPress={()=>{void Linking.openSettings().catch(()=>undefined);}}
              style={styles.locationSettings}>
              <Text style={[styles.caption,{color:palette.text, fontWeight:'700'}]}>iPhone uygulama izinlerini aç</Text>
              <Ionicons name="open-outline" size={16} color={palette.text}/>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
  locationAction:{marginTop:13,minHeight:46,borderRadius:13,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  locationActionText:{fontSize:13,fontWeight:'800'},
  locationSettings:{minHeight:43,marginTop:7,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
});
