import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/theme';
import { absoluteMediaUrl, type B2BProduct } from '@/lib/api';
import { FlashProductBadge } from './FlashProductBadge';

// Exactly 2.5 cards plus two gaps fit within the visible horizontal strip.
export function stripProductWidth(viewport: number) {
  return Math.max(1, Math.floor((viewport - 2 * spacing.sm) / 2.5));
}
export function gridProductWidth(viewport: number) {
  return Math.max(1, Math.floor((viewport - spacing.sm) / 2));
}
function money(value: string | number) {
  return Number(value).toLocaleString('tr-TR', {minimumFractionDigits:2,maximumFractionDigits:2}) + ' ₺';
}
type Props = {
  product: B2BProduct;
  width: number;
  signedIn: boolean;
  newArrival?: boolean;
  onPress: () => void;
  onLogin: () => void;
  onExpire?: () => void;
};
export function CompactProductCard({product,width,signedIn,newArrival,onPress,onLogin,onExpire}:Props) {
  const raw = (typeof product.image_data === 'string' && product.image_data.trim() ? product.image_data :
    product.images?.find(v=>typeof v==='string'&&v.trim())) || product.image_url;
  const image = absoluteMediaUrl(raw);
  const pack = Math.max(1,Number(product.units_per_box)||1);
  const minBoxes = Math.max(1,Number(product.min_order_qty)||1);
  const stock = Math.max(0,Number(product.stock)||0);
  const canOrder = stock >= pack * minBoxes;
  // The standard card has no visible timer. Keep a one-shot expiry check so
  // the badge disappears and the catalogue refreshes when the offer ends.
  const endAt = product.timed_campaign_end_at || '';
  const deadline = Date.parse(endAt);
  const campaignKey = String(product.id)+':'+String(product.timed_campaign_id||'')+':'+endAt;
  const [expiredKey,setExpiredKey] = useState('');
  const notifiedKey = useRef('');
  const refreshRef = useRef(onExpire);
  refreshRef.current = onExpire;
  const hasTimedOffer = !product.marketplace && Boolean(product.timed_campaign_id) && Number.isFinite(deadline);
  const expired = hasTimedOffer && (expiredKey===campaignKey || deadline<=Date.now());
  const flashActive = hasTimedOffer && !expired && canOrder;
  useEffect(()=>{
    if(!hasTimedOffer)return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check=()=>{
      if(timer!==undefined)clearTimeout(timer);
      const remaining=deadline-Date.now();
      if(remaining<=0){
        setExpiredKey(campaignKey);
        if(notifiedKey.current!==campaignKey){
          notifiedKey.current=campaignKey;
          refreshRef.current?.();
        }
      }else{
        timer=setTimeout(check,Math.min(remaining+1,2_147_483_647));
      }
    };
    check();
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')check();});
    return ()=>{if(timer!==undefined)clearTimeout(timer);subscription.remove();};
  },[hasTimedOffer,deadline,campaignKey]);
  const badgeSize = Math.min(46,Math.max(30,Math.round(width*0.30)));
  // Do not present an expired promotional price while waiting for fresh catalog data.
  const price = expired ? null : product.price;
  const hasPrice = price != null && String(price).trim()!=='' && Number.isFinite(Number(price));
  return <Pressable style={[styles.card,{width}]} onPress={onPress} accessibilityRole="button"
    accessibilityLabel={product.name || 'Ürün detayını aç'}>
    <View style={styles.imageWrap}>
      {image ? <Image source={{uri:image}} style={[styles.image,!canOrder&&styles.faded]} contentFit="contain"
        cachePolicy="memory-disk" recyclingKey={String(product.id)} /> :
        <Ionicons name="cube-outline" size={30} color="#9CA3AF"/>}
      {newArrival ? <View style={styles.newBadge}><Text style={styles.newText}>YENİ</Text></View> : null}
      {flashActive ? <FlashProductBadge size={badgeSize}/>:null}
    </View>
    <View style={styles.body}>
      <Text style={styles.sku} numberOfLines={1}>{product.sku || 'Ürün'}</Text>
      <Text style={styles.name} numberOfLines={2}>{product.name || 'Ürün'}</Text>
      {product.seller_name ? <Text style={styles.seller} numberOfLines={1}>{product.seller_name}</Text> : null}
      <View style={[styles.stockBadge,!canOrder&&styles.noStockBadge]}>
        <View style={[styles.dot,!canOrder&&styles.noStockDot]}/>
        <Text style={[styles.stockText,!canOrder&&styles.noStockText]} numberOfLines={1}>
          {canOrder?'Stokta':stock===0?'Stokta yok':'Stok yetersiz'}
        </Text>
      </View>
      <View style={styles.priceBlock}>
        <Text style={styles.priceLabel}>Toptan Fiyat</Text>
        {signedIn && hasPrice && price != null ? <>
          {flashActive && product.original_price!=null &&
            Number.isFinite(Number(product.original_price)) ? <Text style={styles.oldPrice} numberOfLines={1}>{money(product.original_price)}</Text>:null}
          <Text style={[styles.price,!canOrder&&styles.disabledPrice]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{money(price)}</Text>
        </>:!signedIn?<Pressable onPress={e=>{e.stopPropagation();onLogin();}} style={styles.login} accessibilityRole="button">
          <Ionicons name="lock-closed-outline" color="#815900" size={11}/><Text style={styles.loginText} numberOfLines={1}>Giriş Yap</Text>
        </Pressable>:<Text style={styles.priceLabel}>{expired?'Fiyat güncelleniyor…':'Fiyat belirtilmedi'}</Text>}
      </View>
    </View>
  </Pressable>;
}
const styles=StyleSheet.create({
  card:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E5E7EB',borderRadius:13,overflow:'hidden',flexShrink:0},
  imageWrap:{width:'100%',aspectRatio:1,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
  image:{width:'100%',height:'100%'},faded:{opacity:0.45},
  newBadge:{position:'absolute',top:6,left:6,paddingHorizontal:5,paddingVertical:3,borderRadius:5,backgroundColor:'#FFCD00'},
  newText:{fontSize:9,fontWeight:'400',color:'#111827'},
  body:{padding:8,gap:4,flex:1},
  sku:{fontSize:9,lineHeight:12,color:'#68707D',fontWeight:'400'},
  name:{fontSize:12,lineHeight:16,minHeight:32,fontWeight:'400',color:'#171717'},
  seller:{fontSize:9,lineHeight:12,color:'#6B7280',fontWeight:'400'},
  stockBadge:{alignSelf:'flex-start',maxWidth:'100%',borderRadius:6,paddingHorizontal:5,paddingVertical:3,backgroundColor:'#DCFCE7',flexDirection:'row',alignItems:'center',gap:3},
  dot:{width:6,height:6,borderRadius:3,backgroundColor:'#16A34A'},
  stockText:{fontSize:9,lineHeight:12,color:'#166534',fontWeight:'400',flexShrink:1},
  noStockBadge:{backgroundColor:'#FEE2E2'},noStockDot:{backgroundColor:'#DC2626'},noStockText:{color:'#991B1B'},
  priceBlock:{marginTop:'auto',paddingTop:5,gap:2},
  priceLabel:{fontSize:10,lineHeight:13,color:'#555555',fontWeight:'400'},
  price:{fontSize:15,lineHeight:20,fontWeight:'400',color:'#111111'},
  oldPrice:{fontSize:10,color:'#6B7280',textDecorationLine:'line-through',fontWeight:'400'},
  disabledPrice:{color:'#9CA3AF'},
  login:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#FFF6D5',paddingVertical:4,paddingHorizontal:5,borderRadius:5},
  loginText:{fontSize:10,color:'#815900',fontWeight:'400',flexShrink:1},
});
