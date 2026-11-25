import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAppearance } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { appAlert } from '@/lib/appAlert';
import { getStoreNearbyPermissionStatus, requestStoreNearbyOptIn, revokeStoreNearby } from '@/lib/store-geofence';
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
  locationAction:{marginTop:13,minHeight:46,borderRadius:13,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  locationActionText:{fontSize:13,fontWeight:'800'},
  locationSettings:{minHeight:43,marginTop:7,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
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
