import {useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {Image} from 'expo-image';
import {Ionicons} from '@expo/vector-icons';
import {useFocusEffect,useRouter} from 'expo-router';
import {Screen} from '@/components/ui/Screen';
import {useAppearance} from '@/contexts/AppearanceContext';
import {useAuth} from '@/contexts/AuthContext';
import {absoluteMediaUrl,homepageMediaUrl,rmaApi,type B2BHomepage,type B2BProduct} from '@/lib/api';

function photo(product:B2BProduct):string|null {
  const image=(typeof product.image_data==='string'&&product.image_data.trim()
    ? product.image_data : Array.isArray(product.images)
      ? product.images.find(v=>typeof v==='string'&&v.trim()) : null)||
      product.image_url||null;
  return absoluteMediaUrl(image);
}
function currency(value:unknown){
  const number=Number(value);
  return Number.isFinite(number)
    ?number.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₺'
    :'Fiyat belirtilmedi';
}
function remaining(endAt:string,now:number) {
  const difference=Math.max(0,new Date(endAt).getTime()-now);
  if(!Number.isFinite(difference)||difference===0)return 'Kampanya sona erdi';
  const days=Math.floor(difference/86400000);
  const hours=Math.floor(difference%86400000/3600000);
  const mins=Math.floor(difference%3600000/60000);
  const seconds=Math.floor(difference%60000/1000);
  return (days?days+' gün ':'')+[hours,mins,seconds].map(n=>String(n).padStart(2,'0')).join(':');
}
export default function CampaignsScreen(){
  const {palette}=useAppearance();
  const {session}=useAuth();
  const router=useRouter();
  const {width}=useWindowDimensions();
  const [homepage,setHomepage]=useState<B2BHomepage|null>(null);
  const [products,setProducts]=useState<B2BProduct[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [now,setNow]=useState(Date.now());
  const load=useCallback(async()=>{
    const [homeResult,productResult]=await Promise.allSettled([
      rmaApi.getB2BHomepage(),rmaApi.listB2BProducts(true)
    ]);
    if(homeResult.status==='fulfilled')setHomepage(homeResult.value);
    if(productResult.status==='fulfilled')setProducts(Array.isArray(productResult.value)?productResult.value:[]);
    if(homeResult.status==='rejected'||productResult.status==='rejected')
      setError('Kampanya bilgilerine ulaşılamadı. Yeniden deneyin.');
    else setError('');
    setLoading(false);
  },[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const config=homepage?.roundBottomBanner;
  const active=Boolean(config?.enabled&&config.imageId&&config.productIds?.length&&
    (!config.endAt||new Date(config.endAt).getTime()>now));
  const ordered=useMemo(()=>{
    const lookup=new Map(products.filter(p=>!p.marketplace).map(p=>[String(p.id),p]));
    return (config?.productIds||[]).map(id=>lookup.get(String(id)))
      .filter((p):p is B2BProduct=>Boolean(p));
  },[products,config?.productIds]);
  const background=config?.backgroundColor||'#0B1225';
  const accent=config?.accentColor||'#FFCD00';
  const heroText=config?.textColor||'#FFFFFF';
  const cardWidth=Math.max(140,Math.floor((width-44)/2));
  const back=()=>{if(router.canGoBack())router.back();else router.replace('/(tabs)' as never);};

  return <Screen style={{backgroundColor:palette.background}}>
    <View style={[styles.topBar,{borderBottomColor:palette.border,backgroundColor:palette.surface}]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={back}
        style={styles.goBack}><Ionicons name="arrow-back" color={palette.text} size={22}/></Pressable>
      <Text style={[styles.topTitle,{color:palette.text}]} numberOfLines={1}>Flash Ürünler / Kampanyalar</Text>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {loading?<View style={styles.loading}><ActivityIndicator color={accent}/><Text style={{color:palette.textSecondary,marginTop:12}}>Kampanya yükleniyor…</Text></View>:
        !active?<View style={styles.loading}>
          <Ionicons name="megaphone-outline" size={44} color={palette.muted}/>
          <Text style={[styles.emptyTitle,{color:palette.text}]}>Bu kampanya şu anda yayında değil</Text>
          <Text style={{color:palette.textSecondary,textAlign:'center',marginTop:8}}>Yeni fırsatlar için ana sayfayı ziyaret edin.</Text>
          <Pressable onPress={back} style={[styles.returnButton,{backgroundColor:accent}]}><Text style={styles.returnText}>Ana Sayfaya Dön</Text></Pressable>
        </View>:<>
          <View style={[styles.hero,{backgroundColor:background}]}>
            {config!.heroImageId&&homepageMediaUrl(config!.heroImageId)?<Image
              source={{uri:homepageMediaUrl(config!.heroImageId)!}}
              style={StyleSheet.absoluteFillObject} contentFit="cover"/>:null}
            {config!.heroImageId?<View style={[StyleSheet.absoluteFillObject,{backgroundColor:background,opacity:0.65}]}/>:null}
            <View style={styles.heroBody}>
              <View style={[styles.badge,{borderColor:accent}]}><Ionicons name="flash" size={14} color={accent}/>
                <Text style={[styles.badgeText,{color:accent}]}>{config!.badgeText}</Text></View>
              <Text style={[styles.heroTitle,{color:heroText}]}>{config!.title}</Text>
              <Text style={[styles.heroDescription,{color:heroText}]}>{config!.subtitle}</Text>
              {config!.showCountdown&&config!.endAt?<View style={styles.timer}>
                <Ionicons name="time-outline" color={accent} size={18}/>
                <Text style={[styles.timerText,{color:heroText}]}>Kalan süre: {remaining(config!.endAt,now)}</Text>
              </View>:null}
              <Text style={[styles.productCount,{color:accent}]}>{ordered.length} fırsat ürünü</Text>
            </View>
          </View>
          <View style={styles.listHeader}>
            <Text style={[styles.listTitle,{color:palette.text}]}>Kampanya Ürünleri</Text>
            <Text style={[styles.count,{color:palette.muted}]}>{ordered.length} ürün</Text>
          </View>
          {error?<Text style={[styles.alert,{color:'#EF4444'}]}>{error}</Text>:null}
          {!ordered.length?<View style={styles.loading}>
            <Ionicons name="cube-outline" size={42} color={palette.muted}/>
            <Text style={[styles.emptyTitle,{color:palette.text}]}>Henüz yayında ürün bulunmuyor.</Text>
          </View>:<View style={styles.cards}>
            {ordered.map(item=>{
              const image=photo(item);
              const hasPrice=config!.showPrices&&Boolean(session)&&item.price!==null&&item.price!==undefined;
              return <Pressable key={String(item.id)} accessibilityRole="button"
                accessibilityLabel={item.name+' ürün detayını aç'}
                onPress={()=>router.push({pathname:'/product/[id]',params:{id:String(item.id)}} as never)}
                style={[styles.card,{width:cardWidth,backgroundColor:palette.surface,borderColor:palette.border}]}>
                <View style={[styles.imageFrame,{backgroundColor:palette.surfaceSecondary,
                  height:config!.cardStyle==='compact'?cardWidth*0.7:cardWidth*0.93}]}>
                  {image?<Image source={{uri:image}} style={{width:'100%',height:'100%'}} contentFit="contain"
                    cachePolicy="memory-disk"/>:
                    <Ionicons name="cube-outline" size={38} color={palette.muted}/>}
                  <View style={[styles.flashBadge,{backgroundColor:accent}]}><Text style={styles.flashText}>FIRSAT</Text></View>
                </View>
                <View style={styles.cardBody}>
                  <Text numberOfLines={1} style={[styles.sku,{color:palette.muted}]}>{item.sku||'ÜRÜN'}</Text>
                  <Text numberOfLines={2} style={[styles.itemTitle,{color:palette.text}]}>{item.name}</Text>
                  {hasPrice?<Text style={[styles.price,{color:palette.text}]}>{currency(item.price)}</Text>:
                    <Text style={[styles.priceHidden,{color:palette.textSecondary}]}>
                      {config!.showPrices&&!session?'Fiyat için giriş yapın':'Fiyat bilgisi gizli'}
                    </Text>}
                  {config!.cardStyle==='standard'&&<View style={[styles.pack,{backgroundColor:palette.surfaceSecondary}]}>
                    <Text style={[styles.packText,{color:palette.textSecondary}]}>Koli: {Math.max(1,Number(item.units_per_box)||1)} adet · Min: {Math.max(1,Number(item.min_order_qty)||1)} koli</Text>
                  </View>}
                </View>
              </Pressable>;
            })}
          </View>}
        </>
      }
    </ScrollView>
  </Screen>;
}
const styles=StyleSheet.create({
  topBar:{height:58,flexDirection:'row',alignItems:'center',paddingHorizontal:15,borderBottomWidth:1,gap:10},
  goBack:{width:40,height:40,alignItems:'center',justifyContent:'center',borderRadius:12},
  topTitle:{fontSize:16,fontWeight:'800',flex:1},
  container:{paddingBottom:55},
  loading:{minHeight:270,alignItems:'center',justifyContent:'center',padding:24},
  emptyTitle:{fontSize:18,fontWeight:'800',textAlign:'center',marginTop:15},
  returnButton:{marginTop:24,borderRadius:12,paddingHorizontal:24,paddingVertical:14},
  returnText:{color:'#111827',fontWeight:'800'},
  hero:{minHeight:235,position:'relative',overflow:'hidden'},
  heroBody:{paddingHorizontal:22,paddingVertical:30},
  badge:{borderWidth:1,borderRadius:99,flexDirection:'row',alignItems:'center',alignSelf:'flex-start',gap:6,paddingVertical:6,paddingHorizontal:12,backgroundColor:'rgba(0,0,0,0.2)'},
  badgeText:{fontSize:11,fontWeight:'800',letterSpacing:0.5},
  heroTitle:{fontSize:30,fontWeight:'900',marginTop:18,letterSpacing:-0.5},
  heroDescription:{fontSize:14,opacity:0.9,marginTop:12,lineHeight:21},
  timer:{marginTop:20,flexDirection:'row',alignItems:'center',alignSelf:'flex-start',borderRadius:12,borderWidth:1,borderColor:'rgba(255,255,255,0.2)',backgroundColor:'rgba(0,0,0,0.25)',padding:12,gap:8},
  timerText:{fontSize:13,fontWeight:'800',fontVariant:['tabular-nums']},
  productCount:{fontSize:12,fontWeight:'800',marginTop:18},
  listHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingTop:23,paddingBottom:14},
  listTitle:{fontSize:18,fontWeight:'900'},
  count:{fontSize:12,fontWeight:'700'},
  alert:{paddingHorizontal:16,marginBottom:14},
  cards:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:12,paddingHorizontal:16},
  card:{borderWidth:1,borderRadius:16,overflow:'hidden',marginBottom:3},
  imageFrame:{width:'100%',justifyContent:'center',alignItems:'center',position:'relative'},
  flashBadge:{position:'absolute',top:9,left:9,borderRadius:7,paddingVertical:5,paddingHorizontal:8},
  flashText:{fontSize:10,fontWeight:'900',color:'#111827'},
  cardBody:{padding:10,gap:5},
  sku:{fontSize:10,fontWeight:'600'},
  itemTitle:{fontSize:13,fontWeight:'800',minHeight:35,lineHeight:18},
  price:{fontSize:15,fontWeight:'900',marginTop:5},
  priceHidden:{fontSize:11,fontWeight:'600',marginTop:5},
  pack:{padding:7,borderRadius:8,marginTop:5},
  packText:{fontSize:10,fontWeight:'600'},
});
