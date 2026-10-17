import { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
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
  const [loading,setLoading]=useState(true);const [refreshing,setRefreshing]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const draftKey=useRef<string|null>(null);
  const load=useCallback(async(pull=false)=>{
    if(pull)setRefreshing(true);else setLoading(true);
    try{setCart(await rmaApi.getMarketplaceCart());setError('');}
    catch(e){setError(e instanceof Error?e.message:'Sepet yüklenemedi.');}
    finally{setLoading(false);setRefreshing(false);}
  },[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  const remove=async(id:number)=>{
    if(busy)return;setBusy(true);
    try{await rmaApi.removeMarketplaceCart(id);draftKey.current=null;await load(true);}
    catch(e){setError(e instanceof Error?e.message:'Ürün silinemedi.');}
    finally{setBusy(false);}
  };
  const draft=async()=>{
    if(busy||!cart?.items.length||cart.items.some(x=>!x.valid))return;
    setBusy(true);setError('');
    try{
      if(!draftKey.current)draftKey.current=requestKey();
      const saved=await rmaApi.createMarketplaceOrderDraft(draftKey.current);
      appAlert('Sipariş taslağı oluşturuldu','Taslak #'+saved.id+' kaydedildi. Pazaryerinde online ödeme ve kesin sipariş henüz aktif değil.',undefined,'success');
    }catch(e){setError(e instanceof Error?e.message:'Sipariş taslağı oluşturulamadı.');}
    finally{setBusy(false);}
  };
  return <ScrollView style={[styles.page,{backgroundColor:palette.background}]} contentContainerStyle={styles.body}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)}/>}>
    <Pressable onPress={()=>router.back()} style={styles.back}><Ionicons name="chevron-back" size={21} color={palette.text}/><Text style={{color:palette.text,fontWeight:'800'}}>Geri</Text></Pressable>
    <Text style={[styles.heading,{color:palette.text}]}>Sepetim</Text>
    <Text style={[styles.info,{color:palette.textSecondary}]}>Tedarikçi pazaryeri ürünleri</Text>
    {error?<Text style={styles.error}>{error}</Text>:null}
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
      <Text style={[styles.info,{color:palette.textSecondary}]}>Teslimat, satıcı ve koli kuralları uygulama tarafından doğrulanır.</Text>
      <Text style={styles.notice}>{cart.notice||'Online ödeme ve kesin sipariş henüz aktif değil.'}</Text>
      <Pressable disabled={busy||cart.items.some(i=>!i.valid)} onPress={()=>void draft()}
        style={[styles.action,(busy||cart.items.some(i=>!i.valid))&&{opacity:0.5}]}>
        <Text style={styles.actionText}>{busy?'Kaydediliyor…':'Sipariş Taslağı Oluştur'}</Text>
      </Pressable>
    </View> : null}
  </ScrollView>;
}
const styles=StyleSheet.create({
  page:{flex:1},body:{padding:16,paddingBottom:60,gap:12},back:{flexDirection:'row',alignItems:'center',gap:5,minHeight:44},
  heading:{fontWeight:'900',fontSize:23},info:{fontSize:12,lineHeight:18},error:{color:'#B91C1C',fontSize:12},
  item:{flexDirection:'row',alignItems:'center',gap:11,padding:11,borderWidth:1,borderRadius:14},
  imageWrap:{width:78,height:78,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',borderRadius:9,padding:4},
  image:{width:'100%',height:'100%'},name:{fontSize:13,fontWeight:'800'},total:{fontWeight:'900',fontSize:16},
  empty:{textAlign:'center',padding:40},
  summary:{borderRadius:14,borderWidth:1,padding:18,gap:12,marginTop:10},
  notice:{padding:11,backgroundColor:'#FFF3CD',color:'#854D0E',fontSize:12,lineHeight:19,borderRadius:9},
  action:{padding:15,borderRadius:12,alignItems:'center',backgroundColor:'#FFCD00'},actionText:{color:'#111827',fontWeight:'900'},
});
