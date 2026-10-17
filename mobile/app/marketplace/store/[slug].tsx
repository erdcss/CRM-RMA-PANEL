import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAppearance } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { absoluteMediaUrl, rmaApi, type MarketplaceProduct, type MarketplaceStore } from '@/lib/api';
import { asCatalogProduct, productParams } from '@/lib/marketplace-products';
import { appAlert } from '@/lib/appAlert';

function price(value: number | string | null | undefined) {
  if(value == null) return 'Fiyat için giriş yapın';
  const number=Number(value);
  return Number.isFinite(number) ? number.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₺' : 'Fiyat için giriş yapın';
}
export default function SellerStore() {
  const { slug }=useLocalSearchParams<{slug:string}>();
  const router=useRouter();
  const {session}=useAuth();
  const {palette}=useAppearance();
  const [store,setStore]=useState<MarketplaceStore|null>(null);
  const [products,setProducts]=useState<MarketplaceProduct[]>([]);
  const [following,setFollowing]=useState(false);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  const refresh=useCallback(async (pull=false)=>{
    if(pull)setRefreshing(true);else setLoading(true);
    setError('');
    const results=await Promise.allSettled([
      rmaApi.getMarketplaceStore(String(slug)),
      rmaApi.listMarketplaceStoreProducts(String(slug)),
      session ? rmaApi.listMarketplaceFollows() : Promise.resolve([]),
    ]);
    if(results[0].status==='fulfilled')setStore(results[0].value);
    else setError(results[0].reason instanceof Error ? results[0].reason.message : 'Mağaza bulunamadı');
    if(results[1].status==='fulfilled')setProducts(results[1].value);
    else setError(previous=>previous || 'Mağaza ürünleri yüklenemedi.');
    if(results[2].status==='fulfilled')setFollowing(results[2].value.some(f=>f.slug===slug));
    setLoading(false);setRefreshing(false);
  },[slug,session?.user?.id]);
  useFocusEffect(useCallback(()=>{void refresh();},[refresh]));
  const navigate=(pathname:string,params?:Record<string,string>)=>router.push({pathname,params} as never);
  const requiresLogin=()=>{if(session)return false;router.push('/login');return true;};
  const follow=async()=>{
    if(requiresLogin()||busy)return;
    setBusy(true);
    try{
      if(following)await rmaApi.unfollowMarketplaceStore(String(slug));
      else await rmaApi.followMarketplaceStore(String(slug));
      setFollowing(!following);
      setStore(current=>current?{...current,followers:Math.max(0,Number(current.followers)+(following?-1:1))}:current);
    }catch(e){appAlert('Mağaza takip edilemedi',e instanceof Error?e.message:'Tekrar deneyin.');}
    finally{setBusy(false);}
  };
  if(loading&&!store)return <SafeAreaView edges={['top','bottom']} style={[styles.page,{backgroundColor:palette.background}]}><Text style={[styles.info,{color:palette.text}]}>Mağaza yükleniyor…</Text></SafeAreaView>;
  if(!store)return <SafeAreaView edges={['top','bottom']} style={[styles.page,{backgroundColor:palette.background}]}><Text style={[styles.info,{color:palette.text}]}>{error||'Mağaza bulunamadı'}</Text></SafeAreaView>;
  return <SafeAreaView edges={['top','bottom']} style={[styles.page,{backgroundColor:palette.background}]}><ScrollView style={styles.page} contentContainerStyle={styles.body}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh(true)}/>}>
    <Pressable style={styles.back} onPress={()=>router.back()}><Ionicons name="chevron-back" size={20} color={palette.text}/><Text style={{color:palette.text,fontWeight:'700'}}>Geri</Text></Pressable>
    <View style={styles.banner}>
      {store.content?.bannerUrl ? <Image source={{uri:absoluteMediaUrl(store.content.bannerUrl)||undefined}} style={styles.full} contentFit="cover"/> : null}
    </View>
    <View style={[styles.profile,{backgroundColor:palette.surface,borderColor:palette.border}]}>
      <View style={styles.avatar}>
        {store.content?.logoUrl ? <Image source={{uri:absoluteMediaUrl(store.content.logoUrl)||undefined}} style={styles.full} contentFit="contain"/>:
          <Ionicons name="storefront" size={39} color="#854D0E"/>}
      </View>
      <View style={styles.companyRow}>
        <Text style={[styles.company,{color:palette.text}]}>{store.company_name}</Text>
        <Ionicons name="checkmark-circle" size={19} color="#16A34A"/>
        <Text style={[styles.followers,{color:palette.textSecondary}]}>{Number(store.followers)||0} takipçi</Text>
      </View>
      <Text style={[styles.bio,{color:palette.textSecondary}]}>{store.content?.tagline||store.description||'Onaylı Çalışkan B2B tedarikçisi'}</Text>
      <Pressable accessibilityRole="button" onPress={()=>{if(!requiresLogin())navigate('/marketplace/chat/[slug]',{slug:String(slug)})}} style={styles.messageButton}>
        <Ionicons name="chatbubbles-outline" size={17} color="#111827"/><Text style={styles.messageButtonText}>İletişime Geç</Text>
      </Pressable>
      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={()=>{if(!requiresLogin())navigate('/marketplace/quote/[slug]',{slug:String(slug)})}}>
          <Ionicons name="document-text-outline" size={19} color="#111827"/><Text style={styles.actionText}>Teklif İste</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={()=>{if(!requiresLogin())navigate('/marketplace/cart')}}>
          <Ionicons name="cart-outline" size={19} color="#111827"/><Text style={styles.actionText}>Sepetim</Text>
        </Pressable>
        <Pressable style={[styles.action,following&&styles.following]} disabled={busy} onPress={()=>void follow()}>
          <Ionicons name={following?'checkmark-circle':'heart-outline'} size={18} color="#111827"/>
          <Text style={styles.actionText}>{following?'Takip Ediliyor':'Takip Et'}</Text>
        </Pressable>
      </View>
    </View>
    <Text style={[styles.section,{color:palette.text}]}>Ürünler</Text>
    {error ? <Text style={{color:'#B91C1C',marginBottom:8}}>{error}</Text>:null}
    <View style={styles.grid}>{products.map(item=>{
      const product=asCatalogProduct({...item,seller_slug:String(slug),seller_name:store.company_name,
        seller_logo_url:store.content?.logoUrl||null});
      return <Pressable key={String(item.id)} style={[styles.card,{backgroundColor:palette.surface,borderColor:palette.border}]}
        onPress={()=>router.push({pathname:'/product/[id]',params:productParams(product)} as never)}>
        <View style={styles.imageBox}>{item.content.imageUrl
          ? <Image source={{uri:absoluteMediaUrl(item.content.imageUrl)||undefined}} style={styles.full} contentFit="contain"/>
          : <Ionicons name="cube-outline" color="#94A3B8" size={35}/>}</View>
        <View style={styles.cardInfo}>
          <Text numberOfLines={1} style={[styles.sku,{color:palette.textSecondary}]}>{item.sku||'STOK'}</Text>
          <Text numberOfLines={2} style={[styles.productName,{color:palette.text}]}>{item.content.name}</Text>
          <Text style={[styles.price,{color:palette.text}]}>{price(item.content.price)}</Text>
          <Text numberOfLines={1} style={[styles.sku,{color:palette.textSecondary}]}>Koli içi {Math.max(1,Number(item.content.unitsPerBox)||1)} · Min. {Math.max(1,Number(item.content.minBoxes)||1)}</Text>
        </View>
      </Pressable>
    })}</View>
    {!products.length&&!error ? <Text style={[styles.info,{color:palette.textSecondary}]}>Henüz onaylı ürün yayınlanmamış.</Text>:null}
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1},body:{paddingHorizontal:14,paddingTop:8,paddingBottom:50},back:{flexDirection:'row',alignItems:'center',gap:5,paddingVertical:13,minHeight:48},
  banner:{aspectRatio:3,backgroundColor:'#FFCD00',overflow:'hidden',borderTopLeftRadius:16,borderTopRightRadius:16},
  full:{width:'100%',height:'100%'},profile:{borderWidth:1,borderTopWidth:0,borderBottomLeftRadius:16,borderBottomRightRadius:16,padding:15,paddingTop:43},
  avatar:{position:'absolute',top:-38,left:15,height:76,width:76,borderWidth:4,borderColor:'#FFFFFF',borderRadius:18,backgroundColor:'#FFCD00',overflow:'hidden',alignItems:'center',justifyContent:'center'},
  companyRow:{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'},company:{fontSize:20,fontWeight:'900',flexShrink:1},
  followers:{fontSize:11,fontWeight:'700'},bio:{fontSize:12,lineHeight:18,marginTop:7},
  actions:{flexDirection:'row',gap:7,marginTop:12},action:{flex:1,minHeight:54,borderRadius:12,backgroundColor:'#FFCD00',alignItems:'center',justifyContent:'center',gap:2,paddingHorizontal:3},
  following:{backgroundColor:'#E2E8F0'},actionText:{fontSize:11,color:'#111827',fontWeight:'800',textAlign:'center'},
  messageButton:{marginTop:14,borderRadius:10,flexDirection:'row',justifyContent:'center',alignItems:'center',backgroundColor:'#FDE68A',gap:6,padding:10},
  messageButtonText:{fontSize:12,fontWeight:'800',color:'#111827'},
  section:{fontSize:21,fontWeight:'900',marginVertical:17},grid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  card:{width:'48%',minWidth:0,borderRadius:16,borderWidth:1,overflow:'hidden'},
  imageBox:{aspectRatio:1,backgroundColor:'#FAFAFA',alignItems:'center',justifyContent:'center'},
  cardInfo:{padding:12,gap:5},productName:{fontSize:14,fontWeight:'700',minHeight:42,marginTop:2},sku:{fontSize:10},
  price:{fontSize:16,fontWeight:'800',marginTop:7},info:{padding:20,textAlign:'center'},
});
