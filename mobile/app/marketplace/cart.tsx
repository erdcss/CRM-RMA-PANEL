import { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppearance } from '@/contexts/AppearanceContext';
import { absoluteMediaUrl, rmaApi, type MarketplaceCart } from '@/lib/api';
import { appAlert } from '@/lib/appAlert';

const money=(n:number)=>Number(n||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₺';
function requestKey(){
  // Idempotency label, NOT a credential or proof of payment.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
    const r=Math.floor(Math.random()*16);
    return (c==='x'?r:(r&3)|8).toString(16);
  });
}
export default function MarketplaceCartPage(){
  const {palette}=useAppearance();const router=useRouter();
  const [cart,setCart]=useState<MarketplaceCart|null>(null);
  const [pastOrders,setPastOrders]=useState<Array<{id:number;status:string;subtotal:number;created_at:string}>>([]);
  const [loading,setLoading]=useState(true);const [refreshing,setRefreshing]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [confirmed,setConfirmed]=useState<number|null>(null);
  const orderKey=useRef<string|null>(null);
  const load=useCallback(async(pull=false)=>{
    if(pull)setRefreshing(true);else setLoading(true);
    try{
      const [cartResult,ordersResult]=await Promise.allSettled([rmaApi.getMarketplaceCart(),rmaApi.listMarketplaceOrders()]);
      if(cartResult.status==='rejected')throw cartResult.reason;
      setCart(cartResult.value);
      if(ordersResult.status==='fulfilled')setPastOrders(ordersResult.value);
      setError('');
    }catch(e){setError(e instanceof Error?e.message:'Sepet yüklenemedi.');}
    finally{setLoading(false);setRefreshing(false);}
  },[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  const remove=async(id:number)=>{
    if(busy)return;setBusy(true);
    try{await rmaApi.removeMarketplaceCart(id);orderKey.current=null;await load(true);}
    catch(e){setError(e instanceof Error?e.message:'Ürün silinemedi.');}
    finally{setBusy(false);}
  };
  const placeOrder=async()=>{
    if(busy||!cart?.items.length||cart.items.some(x=>!x.valid))return;
    setBusy(true);setError('');
    try{
      if(!orderKey.current)orderKey.current=requestKey();
      const saved=await rmaApi.createMarketplaceOrder(orderKey.current);
      setConfirmed(saved.id);
      await load(true);
      appAlert('Sipariş oluşturuldu','Sipariş #'+saved.id+' tedarikçiye iletildi. Satıcı onayı bekleniyor, ödeme henüz alınmadı.',undefined,'success');
      orderKey.current=null;
    }catch(e){setError(e instanceof Error?e.message:'Sipariş taslağı oluşturulamadı.');}
    finally{setBusy(false);}
  };
  return <SafeAreaView edges={['top','bottom']} style={[styles.page,{backgroundColor:palette.background}]}><ScrollView style={styles.page} contentContainerStyle={styles.body}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)}/>}>
    <Pressable onPress={()=>router.back()} style={styles.back}><Ionicons name="chevron-back" size={21} color={palette.text}/><Text style={{color:palette.text,fontWeight:'800'}}>Geri</Text></Pressable>
    <Text style={[styles.heading,{color:palette.text}]}>Sepetim</Text>
    <Text style={[styles.info,{color:palette.textSecondary}]}>Tedarikçi pazaryeri ürünleri</Text>
    {error?<Text style={styles.error}>{error}</Text>:null}
    {confirmed!=null?<View style={styles.success}><Ionicons name="checkmark-circle" size={22} color="#16A34A"/><View style={{flex:1}}><Text style={styles.successTitle}>Sipariş #{confirmed} oluşturuldu</Text><Text style={styles.successText}>Tedarikçi onayı bekleniyor. Ödeme alınmadı.</Text></View></View>:null}
    {loading?<Text style={{color:palette.textSecondary}}>Sepet yükleniyor…</Text>:null}
    {cart?.items.map(item=><View key={item.id} style={[styles.item,{backgroundColor:palette.surface,borderColor:palette.border}]}>
      <View style={styles.imageWrap}>{item.content?.imageUrl ? <Image source={{uri:absoluteMediaUrl(item.content.imageUrl)||undefined}} style={styles.image} contentFit="contain"/>:
        <Ionicons name="cube-outline" size={26} color="#94A3B8"/>}</View>
      <View style={{flex:1,gap:4}}>
        <Text style={[styles.name,{color:palette.text}]} numberOfLines={2}>{item.content?.name||item.sku}</Text>
        <Text style={[styles.info,{color:palette.textSecondary}]}>{item.company_name} · {item.boxes} koli</Text>
        <Text style={[styles.total,{color:palette.text}]}>{money(item.total)}</Text>
        {!item.valid?<Text style={styles.error}>Stok veya minimum koli miktarı değişmiş.</Text>:null}
      </View>
      <Pressable accessibilityLabel="Ürünü sepetten sil" disabled={busy} onPress={()=>void remove(item.id)} style={{padding:8}}>
        <Ionicons name="trash-outline" size={20} color="#DC2626"/>
      </Pressable>
    </View>)}
    {!loading&&!cart?.items.length?<Text style={[styles.empty,{color:palette.textSecondary}]}>Sepetinizde ürün bulunmuyor.</Text>:null}
    {cart?.items.length ? <View style={[styles.summary,{backgroundColor:palette.surface,borderColor:palette.border}]}>
      <Text style={[styles.total,{color:palette.text}]}>Ara toplam: {money(cart.subtotal)}</Text>
      <Text style={[styles.info,{color:palette.textSecondary}]}>Siparişiniz tedarikçiye iletilir. Ödeme, satıcı onayından sonra ayrıca planlanacaktır.</Text>
      <Pressable disabled={busy||cart.items.some(i=>!i.valid)} onPress={()=>void placeOrder()}
        style={[styles.action,(busy||cart.items.some(i=>!i.valid))&&{opacity:0.5}]}>
        <Text style={styles.actionText}>{busy?'Oluşturuluyor…':'Siparişi Oluştur'}</Text>
      </Pressable>
    </View> : null}
    <View style={{gap:10,marginTop:18}}>
      <Text style={[styles.heading,{color:palette.text,fontSize:19}]}>Oluşturulan Siparişler</Text>
      {pastOrders.map(order=><View key={order.id} style={[styles.item,{backgroundColor:palette.surface,borderColor:palette.border}]}>
        <Ionicons name="receipt-outline" size={23} color={palette.textSecondary}/>
        <View style={{flex:1,gap:4}}>
          <Text style={[styles.name,{color:palette.text}]}>Sipariş #{order.id}</Text>
          <Text style={[styles.info,{color:palette.textSecondary}]}>Tedarikçi onayı bekleniyor · {new Date(order.created_at).toLocaleDateString('tr-TR')}</Text>
        </View>
        <Text style={[styles.total,{color:palette.text}]}>{money(order.subtotal)}</Text>
      </View>)}
      {!pastOrders.length?<Text style={[styles.info,{color:palette.textSecondary}]}>Henüz oluşturulmuş tedarikçi siparişi bulunmuyor.</Text>:null}
    </View>
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1},body:{paddingHorizontal:16,paddingTop:8,paddingBottom:60,gap:12},back:{flexDirection:'row',alignItems:'center',gap:5,minHeight:48},
  success:{flexDirection:'row',gap:9,alignItems:'center',backgroundColor:'#E9F9EF',borderRadius:12,padding:13},
  successTitle:{fontSize:13,color:'#14532D',fontWeight:'900'},successText:{fontSize:12,color:'#166534',marginTop:2},
  heading:{fontWeight:'900',fontSize:23},info:{fontSize:12,lineHeight:18},error:{color:'#B91C1C',fontSize:12},
  item:{flexDirection:'row',alignItems:'center',gap:11,padding:11,borderWidth:1,borderRadius:14},
  imageWrap:{width:78,height:78,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',borderRadius:9,padding:4},
  image:{width:'100%',height:'100%'},name:{fontSize:13,fontWeight:'800'},total:{fontWeight:'900',fontSize:16},
  empty:{textAlign:'center',padding:40},
  summary:{borderRadius:14,borderWidth:1,padding:18,gap:12,marginTop:10},
  notice:{padding:11,backgroundColor:'#FFF3CD',color:'#854D0E',fontSize:12,lineHeight:19,borderRadius:9},
  action:{padding:15,borderRadius:12,alignItems:'center',backgroundColor:'#FFCD00'},actionText:{color:'#111827',fontWeight:'900'},
});
