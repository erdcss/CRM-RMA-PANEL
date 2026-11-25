import {useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Image} from 'expo-image';
import {Ionicons} from '@expo/vector-icons';
import {absoluteMediaUrl,homepageMediaUrl,type B2BProduct,type B2BTimedCampaign} from '@/lib/api';
import {activeFlashGroups,flashClock,flashDiscount} from '@/lib/flash-products';

function currency(value:string|number){return Number(value).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₺';}

export function FlashCountdown({endAt,now}:{endAt:string;now:number}){
  return <View style={styles.timerWrap} accessibilityLabel="Fırsatın bitmesine kalan süre">
    <Text style={styles.timerCaption} numberOfLines={1}>Fırsatın Bitmesine Kalan Süre</Text>
    <View style={styles.timerRow}>
      {flashClock(endAt,now).map((part,index)=><View key={index} style={styles.timerPart}>
        <Text style={styles.timerNumber}>{part}</Text>
        <Text style={styles.timerUnit}>{['sa','dk','sn'][index]}</Text>
      </View>)}
    </View>
  </View>;
}
function FlashTile({product,width,signedIn,onPress}:{product:B2BProduct;width:number;signedIn:boolean;onPress:()=>void}){
  const image=absoluteMediaUrl(product.image_data||product.images?.find(value=>typeof value==='string'&&Boolean(value.trim()))||product.image_url);
  const price=product.price,discount=flashDiscount(product);
  const hasPrice=signedIn&&price!=null&&String(price).trim()!==''&&Number.isFinite(Number(price))&&Number(price)>0;
  return <Pressable accessibilityRole="button" accessibilityLabel={product.name+' ürün detayını aç'}
    onPress={onPress} style={[styles.tile,{width}]}>
    <View style={styles.imageFrame}>
      {image?<Image source={{uri:image}} style={styles.productImage} contentFit="contain" cachePolicy="memory-disk"/>:
        <Ionicons name="cube-outline" color="#BFC1C4" size={20}/>}
    </View>
    <View style={styles.tileBody}>
      <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
      {hasPrice?<>
        {discount>0?<View style={styles.discountBadge}><Text style={styles.discountText}>%{discount}</Text></View>:null}
        {discount>0&&product.original_price!=null?<Text style={styles.oldPrice} numberOfLines={1}>{currency(product.original_price)}</Text>:null}
        <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{currency(price!)}</Text>
      </>:<Text style={styles.noPrice} numberOfLines={2}>{signedIn?'Fiyat belirtilmedi':'Fiyat için giriş yapın'}</Text>}
    </View>
  </Pressable>;
}
export function FlashHomeSection({title,imageId,campaigns,products,signedIn,onRefresh,onRoute}:{
  title:string;imageId?:string;campaigns:B2BTimedCampaign[];products:B2BProduct[];signedIn:boolean;onRefresh:()=>void;onRoute:(path:string)=>void;
}){
  const [now,setNow]=useState(Date.now());
  const [viewport,setViewport]=useState(0);
  const [failedImage,setFailedImage]=useState(false);
  const notified=useRef(new Set<string>());
  const refreshRef=useRef(onRefresh);
  refreshRef.current=onRefresh;
  const image=homepageMediaUrl(imageId);
  useEffect(()=>setFailedImage(false),[image]);
  useEffect(()=>{
    if(!campaigns.length)return;
    const tick=()=>setNow(Date.now());
    tick();const timer=setInterval(tick,1000);
    return ()=>clearInterval(timer);
  },[campaigns]);
  useEffect(()=>{
    const expired=campaigns.filter(c=>Date.parse(c.ends_at)<=now&&!notified.current.has(c.id+':'+c.ends_at));
    if(expired.length){expired.forEach(c=>notified.current.add(c.id+':'+c.ends_at));refreshRef.current();}
  },[campaigns,now]);
  const groups=activeFlashGroups(campaigns,products,now);
  if(!groups.length)return null;
  const tileWidth=viewport?Math.max(80,Math.floor((viewport-8)/3)):112;
  return <View style={styles.shell}>
    {groups.map(({campaign,offers})=><View key={campaign.id} style={styles.group}>
      <View style={styles.header}>
        <View style={styles.titleArea}>
          {image&&!failedImage?<Image source={{uri:image}} style={styles.artwork} contentFit="contain"
            cachePolicy="memory-disk" accessibilityLabel={title} onError={()=>setFailedImage(true)}/>:
            <><View style={styles.titleRow}><Ionicons name="flash" color="#FFCD00" size={20}/>
              <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{title}</Text></View>
              <View style={styles.scarcity}><Text style={styles.scarcityText} numberOfLines={1}>Sınırlı Stok, Kaçırma!</Text></View></>}
        </View>
        <FlashCountdown endAt={campaign.ends_at} now={now}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Tüm Flash Ürünler" onPress={()=>onRoute('/flash-products')}
          style={styles.allButton}><Text style={styles.allText} numberOfLines={2}>Tüm Flash Ürünler</Text>
          <Ionicons name="chevron-forward" color="#151515" size={11}/></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} onLayout={event=>setViewport(event.nativeEvent.layout.width)}
        contentContainerStyle={styles.tiles}>
        {offers.slice(0,12).map(product=><FlashTile key={String(product.id)} product={product} width={tileWidth}
          signedIn={signedIn} onPress={()=>onRoute('/product/'+encodeURIComponent(String(product.id)))}/>)}
      </ScrollView>
    </View>)}
  </View>;
}

const styles=StyleSheet.create({
  shell:{width:'100%',marginTop:5,borderWidth:1,borderColor:'#C8A02C',borderRadius:12,padding:5,backgroundColor:'#191712',gap:7},
  group:{gap:4},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:3},
  titleArea:{flex:1,minWidth:0,alignItems:'flex-start',justifyContent:'center',gap:2},
  artwork:{width:'100%',height:34},
  titleRow:{flexDirection:'row',alignItems:'center',gap:2,width:'100%'},
  title:{color:'#FFFFFF',fontSize:13,lineHeight:17,fontWeight:'400',flex:1,minWidth:0},
  scarcity:{backgroundColor:'#FFCD00',borderRadius:4,paddingHorizontal:3,paddingVertical:1,maxWidth:'100%'},
  scarcityText:{fontSize:7,lineHeight:10,color:'#171717',fontWeight:'400'},
  timerWrap:{flexShrink:0,alignItems:'center',gap:2},
  timerCaption:{color:'#EEEEEE',fontSize:7,lineHeight:10,fontWeight:'400'},
  timerRow:{flexDirection:'row',gap:3,alignItems:'center'},
  timerPart:{minWidth:22,paddingHorizontal:3,paddingVertical:2,borderRadius:4,backgroundColor:'#FFCD00',alignItems:'center'},
  timerNumber:{fontSize:12,lineHeight:14,color:'#151515',fontWeight:'400',fontVariant:['tabular-nums']},
  timerUnit:{fontSize:6,lineHeight:7,color:'#151515',fontWeight:'400'},
  allButton:{maxWidth:'28%',flexDirection:'row',alignItems:'center',gap:2,backgroundColor:'#FFCD00',borderRadius:10,paddingHorizontal:5,paddingVertical:4},
  allText:{fontSize:8,lineHeight:11,color:'#151515',fontWeight:'400',flexShrink:1},
  tiles:{flexDirection:'row',gap:4},
  tile:{height:65,borderRadius:7,borderWidth:1,borderColor:'#625A48',backgroundColor:'#2B2925',flexDirection:'row',alignItems:'center',padding:3,gap:3,overflow:'hidden'},
  imageFrame:{width:'37%',height:'100%',borderRadius:4,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  productImage:{width:'100%',height:'100%'},
  tileBody:{flex:1,minWidth:0,gap:1},
  productName:{fontSize:8,lineHeight:10,color:'#FFFFFF',fontWeight:'400'},
  discountBadge:{alignSelf:'flex-start',backgroundColor:'#D72638',borderRadius:4,paddingHorizontal:3},
  discountText:{fontSize:7,lineHeight:9,color:'#FFFFFF',fontWeight:'400'},
  oldPrice:{fontSize:7,lineHeight:9,color:'#C7C7C7',fontWeight:'400',textDecorationLine:'line-through'},
  noPrice:{fontSize:8,lineHeight:10,color:'#C7C7C7',fontWeight:'400'},
  price:{fontSize:11,lineHeight:13,color:'#FFCD00',fontWeight:'400'},
});
