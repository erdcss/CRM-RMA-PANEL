import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { useAppearance } from '@/contexts/AppearanceContext';
import { rmaApi, type B2BAccount } from '@/lib/api';

type UpdateLinks={appStoreUrl?:string;googlePlayUrl?:string;latestIosVersion?:string;latestAndroidVersion?:string};
const brandingApi=(process.env.EXPO_PUBLIC_BRANDING_API_URL || 'https://admin.ecalisgan.com').replace(/\/$/,'');
function isNewer(latest:string,current:string){
  const a=latest.split('.').map(Number),b=current.split('.').map(Number);
  if(a.some(n=>!Number.isFinite(n))||b.some(n=>!Number.isFinite(n)))return true;
  return a.some((n,i)=>n>(b[i]||0)&&a.slice(0,i).every((v,j)=>v===(b[j]||0)));
}


const rows: Array<{ key: string; label: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'company', label: 'Profil Bilgileri', subtitle: 'Firma ve iletişim bilgileri', icon: 'person-outline' },
  { key: 'orders', label: 'Siparişlerim', subtitle: 'Siparişlerinizi görüntüleyin', icon: 'bag-handle-outline' },
  { key: 'ledger', label: 'Defterim', subtitle: 'Firma hesapları, borç-alacak ve notlar', icon: 'book-outline' },
  { key: 'addresses', label: 'Adreslerim', subtitle: 'Teslimat adreslerinizi yönetin', icon: 'location-outline' },
  { key: 'payments', label: 'Ödeme Bilgilerim', subtitle: 'Kayıtlı ödeme yöntemleri', icon: 'card-outline' },
  { key: 'returns', label: 'İade İşlemleri', subtitle: 'Taleplerinizi takip edin', icon: 'return-down-back-outline' },
  { key: 'invoices', label: 'Faturalarım', subtitle: 'Faturalarınızı görüntüleyin', icon: 'document-text-outline' },
  { key: 'support', label: 'Destek', subtitle: 'Yardım ve iletişim', icon: 'headset-outline' },
  { key: 'notifications', label: 'Bildirimlerim', subtitle: 'Duyurular ve işlem bildirimleri', icon: 'notifications-outline' },
  { key: 'settings', label: 'Ayarlar', subtitle: 'Tema ve uygulama tercihleri', icon: 'settings-outline' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { session, user, signOut } = useAuth();
  const { palette } = useAppearance();
  const [account, setAccount] = useState<B2BAccount | null>(null);
  const [storeLinks,setStoreLinks]=useState<UpdateLinks>({});
  useEffect(()=>{
    let mounted=true;
    fetch(brandingApi+'/api/public/b2b-footer',{headers:{Accept:'application/json'}})
      .then(res=>res.ok?res.json():{})
      .then(data=>{if(mounted)setStoreLinks(data as UpdateLinks);})
      .catch(()=>undefined);
    return ()=>{mounted=false;};
  },[]);
  const currentVersion=Constants.expoConfig?.version || '0.0.0';
  const storeUrl=Platform.OS==='ios'?storeLinks.appStoreUrl:storeLinks.googlePlayUrl;
  const latestVersion=Platform.OS==='ios'?storeLinks.latestIosVersion:storeLinks.latestAndroidVersion;
  const showUpdate=Boolean(storeUrl && /^https:\/\//.test(storeUrl) && (!latestVersion||isNewer(latestVersion,currentVersion)));

  useEffect(() => {
    let mounted = true;
    if (session) void rmaApi.getB2BAccount().then(a => { if(mounted) setAccount(a); }).catch(() => undefined);
    return () => { mounted = false; };
  }, [session?.access_token]);
  const fullName = [account?.firstName, account?.lastName].filter(Boolean).join(' ').trim();
  const displayName = fullName || account?.companyName || user?.email?.split('@')[0] || 'Çalışkan B2B';
  const openRow = (key: string) => {
    if (key === 'orders') router.push('/my-orders');
    else if (key === 'ledger') router.push('/ledger' as never);
    else if (key === 'settings') router.push('/settings');
    else if (key === 'notifications') router.push('/notifications' as never);
    else router.push({ pathname: '/account/[section]', params: { section: key } } as never);
  };
  return <Screen style={{ backgroundColor: palette.background }}>
    <ScrollView contentContainerStyle={styles.page}>
      {showUpdate ? <Pressable style={styles.updateBanner} accessibilityRole="link"
        onPress={()=>{if(storeUrl)void Linking.openURL(storeUrl).catch(()=>undefined);}}>
        <View style={styles.updateIcon}><Ionicons name="cloud-download-outline" size={25} color="#151515"/></View>
        <View style={{flex:1}}><Text style={styles.updateTitle}>Çalışkan B2B uygulamasını güncelle</Text>
          <Text style={styles.updateText}>En yeni özelliklerden yararlanmak için {Platform.OS==='ios'?'App Store':'Google Play'} üzerinden güncelleyin{latestVersion?' · v'+latestVersion:''}.</Text></View>
        <Ionicons name="arrow-forward-circle" size={24} color="#FFCD00"/>
      </Pressable> : null}
      <Text style={[styles.title, { color: palette.text }]}>Hesabım</Text>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>Hesap bilgilerinizi yönetin ve işlemlerinizi takip edin.</Text>
      <View style={[styles.identity, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.avatar, { backgroundColor: palette.surfaceSecondary }]}>
          <Ionicons name="person" size={31} color={palette.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>{displayName}</Text>
          <Text style={{ color: palette.textSecondary, fontSize: 12 }} numberOfLines={1}>{account?.email || user?.email || 'B2B Müşteri'}</Text>
          <Text style={styles.tag}>Kurumsal Hesap</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.muted} />
      </View>
      <View style={{ gap: 8, marginTop: 18 }}>
        {rows.map((item) => (
          <Pressable key={item.key} onPress={() => openRow(item.key)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, { backgroundColor: palette.surface, borderColor: palette.border, opacity: pressed ? 0.8 : 1 }]}>
            <View style={[styles.icon, { backgroundColor: palette.surfaceSecondary }]}>
              <Ionicons name={item.icon} size={22} color={palette.accent === '#FFCD00' && palette.text === '#F7F8FA' ? palette.accent : palette.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>{item.label}</Text>
              <Text style={[styles.rowSubtitle, { color: palette.textSecondary }]}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={palette.muted} />
          </Pressable>
        ))}
        <Pressable onPress={() => void signOut()} style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]} accessibilityRole="button">
          <View style={[styles.icon, { backgroundColor: palette.surfaceSecondary }]}>
            <Ionicons name="log-out-outline" size={22} color="#F87171" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: '#F87171' }]}>Çıkış Yap</Text>
            <Text style={[styles.rowSubtitle, { color: palette.textSecondary }]}>Hesabınızdan güvenle çıkış yapın</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({
  page:{ paddingHorizontal:16,paddingTop:20,paddingBottom:120 },
  updateBanner:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#111827',borderWidth:1,borderColor:'#FFCD00',borderRadius:18,padding:14,marginBottom:18},
  updateIcon:{width:46,height:46,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'#FFCD00'},
  updateTitle:{color:'#FFFFFF',fontWeight:'900',fontSize:14},
  updateText:{color:'#D1D5DB',fontSize:11,marginTop:4,lineHeight:16},
  title:{ fontSize:27,fontWeight:'900' },subtitle:{ fontSize:13,marginTop:4,marginBottom:19 },
  identity:{ flexDirection:'row',alignItems:'center',gap:14,borderRadius:18,borderWidth:1,padding:15,minHeight:94 },
  avatar:{ width:55,height:55,borderRadius:28,alignItems:'center',justifyContent:'center' },
  name:{ fontSize:17,fontWeight:'800',marginBottom:4 },
  tag:{ alignSelf:'flex-start',color:'#151515',backgroundColor:'#FFCD00',overflow:'hidden',borderRadius:12,paddingHorizontal:8,paddingVertical:3,marginTop:7,fontSize:10,fontWeight:'800' },
  row:{ minHeight:68,flexDirection:'row',alignItems:'center',gap:12,borderRadius:13,borderWidth:1,paddingHorizontal:13,paddingVertical:9 },
  icon:{ width:42,height:42,borderRadius:11,alignItems:'center',justifyContent:'center' },
  rowTitle:{ fontSize:14,fontWeight:'700' },rowSubtitle:{ fontSize:12,marginTop:3 },
});
