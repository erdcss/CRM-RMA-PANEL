import {useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Screen} from '@/components/ui/Screen';
import {CompactProductCard,gridProductWidth} from '@/components/products/CompactProductCard';
import {FlashCountdown} from '@/components/home/FlashHomeSection';
import {useAuth} from '@/contexts/AuthContext';
import {rmaApi,type B2BProduct,type B2BTimedCampaign} from '@/lib/api';
import {activeFlashGroups} from '@/lib/flash-products';

export default function FlashProductsScreen(){
  const router=useRouter();
  const {session}=useAuth();
  const {width}=useWindowDimensions();
  const [products,setProducts]=useState<B2BProduct[]>([]);
  const [campaigns,setCampaigns]=useState<B2BTimedCampaign[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [now,setNow]=useState(Date.now());
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [catalog,live]=await Promise.all([rmaApi.listB2BProducts(true),rmaApi.listTimedCampaigns()]);
      setProducts(Array.isArray(catalog)?catalog:[]);setCampaigns(Array.isArray(live)?live:[]);setError(false);
    }catch{setError(true);}finally{setNow(Date.now());setLoading(false);}
  },[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const groups=activeFlashGroups(campaigns,products,now);
  const cardWidth=gridProductWidth(Math.max(1,width-32));
  return <Screen style={{backgroundColor:'#111315'}}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)' as never)}><Ionicons name="arrow-back" size={24} color="#FFFFFF"/></Pressable>
      <Text style={styles.title}>Flash Ürünler</Text>
      <Ionicons name="flash" size={23} color="#FFCD00"/>
    </View>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()} tintColor="#FFCD00"/>}>
      {error?<Pressable onPress={()=>void load()}><Text style={styles.message}>Kampanyalar yüklenemedi. Tekrar dene.</Text></Pressable>:null}
      {!groups.length?(loading?<ActivityIndicator color="#FFCD00"/>:<Text style={styles.message}>Şu anda aktif flash ürün bulunmuyor.</Text>):groups.map(({campaign,offers})=><View key={campaign.id} style={styles.group}>
        <View style={styles.campaignHead}><Text style={styles.campaignTitle}>{campaign.title}</Text><FlashCountdown endAt={campaign.ends_at} now={now}/></View>
        <View style={styles.grid}>{offers.map(product=><CompactProductCard key={String(product.id)} product={product} width={cardWidth}
          signedIn={Boolean(session)} onPress={()=>router.push(('/product/'+encodeURIComponent(String(product.id))) as never)}
          onLogin={()=>router.push('/login')} onExpire={()=>void load()}/>)}</View>
      </View>)}
    </ScrollView>
  </Screen>;
}
const styles=StyleSheet.create({
 header:{flexDirection:'row',alignItems:'center',padding:16,gap:12},
 title:{flex:1,fontSize:18,color:'#FFFFFF',fontWeight:'400'},
 content:{padding:16,gap:16,paddingBottom:40},
 message:{color:'#FFFFFF',fontSize:13,textAlign:'center'},
 group:{gap:10},
 campaignHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
 campaignTitle:{color:'#FFFFFF',fontSize:14,flex:1,fontWeight:'400'},
 grid:{flexDirection:'row',flexWrap:'wrap',gap:8},
});
