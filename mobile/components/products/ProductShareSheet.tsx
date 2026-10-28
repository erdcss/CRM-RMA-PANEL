import {useEffect,useMemo,useRef,useState} from 'react';
import {
  ActivityIndicator,Dimensions,Image as NativeImage,Modal,Pressable,
  ScrollView,StyleSheet,Text,View,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {captureRef} from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import {appAlert} from '@/lib/appAlert';
import {absoluteMediaUrl,type B2BProduct} from '@/lib/api';

// The publicly shared poster must never include pricing, discounts, margins,
// private supplier information or inventory movement history.
export function shareFacts(product:B2BProduct):Array<[string,string]> {
  const rawFeatures=Array.isArray(product.features)?product.features:[];
  const publicFeatures=rawFeatures.filter(
    (value):value is string=>
      typeof value==='string'&&
      !/(?:₺|€|\$|\bTL\b|\bfiyat\b|\bprice\b|\bkâr\b|\bmaliyet\b|\bindirim\b|\bstok\b|\btedarikçi\b)/i.test(value)
  ).slice(0,2);
  const raw:Array<[string,string]>=[
    ['Model / Kod',String(product.sku||'')],
    ['Kategori',String(product.category||'')],
    ['Koli İçi',product.units_per_box?Math.max(1,Number(product.units_per_box))+' adet':''],
    ['Minimum Alım',product.min_order_qty?Math.max(1,Number(product.min_order_qty))+' koli':''],
    ...publicFeatures.map((feature):[string,string]=>['Özellik',feature]),
  ];
  return raw
    .filter((entry)=>entry[1]&&entry[1]!=='NaN adet'&&entry[1]!=='NaN koli')
    .map(([name,value]):[string,string]=>[name,value.replace(/\s+/g,' ').slice(0,55)])
    .slice(0,4);
}

const BRANDING_API=(process.env.EXPO_PUBLIC_BRANDING_API_URL||'https://admin.ecalisgan.com').replace(/\/$/,'');
const POSTER_WIDTH=270;
const POSTER_HEIGHT=480;
type StoreBadges={appStoreImage?:string;googlePlayImage?:string};
function verifiedBadge(value:unknown):string|null {
  const url=absoluteMediaUrl(typeof value==='string'?value:null);
  return url&&/^https:\/\//i.test(url)?url:null;
}

export function ProductShareSheet({
  product,imageUri,logoUri,visible,onClose,
}:{
  product:B2BProduct;imageUri?:string|null;logoUri?:string|null;
  visible:boolean;onClose:()=>void;
}){
  const posterRef=useRef<View>(null);
  const [saving,setSaving]=useState(false);
  const [posterReady,setPosterReady]=useState(false);
  const [imageLoaded,setImageLoaded]=useState(false);
  const [imageFailed,setImageFailed]=useState(false);
  const [badges,setBadges]=useState<StoreBadges>({});
  const facts=useMemo(()=>shareFacts(product),[product]);
  const photo=absoluteMediaUrl(imageUri);
  const appIcon=absoluteMediaUrl(logoUri);
  const posterWidth=Math.min(POSTER_WIDTH,Dimensions.get('window').width-64);

  useEffect(()=>{
    if(!visible)return;
    setSaving(false);
    setPosterReady(false);
    setImageLoaded(false);
    setImageFailed(false);
    setBadges({});
    let active=true;
    const controller=new AbortController();
    // Small JSON response only. Never download, base64-encode, or send image
    // bytes through the JS bridge just because the share sheet was opened.
    fetch(BRANDING_API+'/api/public/b2b-footer',{signal:controller.signal})
      .then(response=>response.ok?response.json():{})
      .then((value:StoreBadges)=>{if(active)setBadges(value||{});})
      .catch(()=>{if(active)setBadges({});});
    return ()=>{active=false;controller.abort();};
  },[visible,product.id]);

  async function share(){
    if(saving)return;
    if(!photo||imageFailed||!imageLoaded||!posterReady||!posterRef.current){
      appAlert('Görsel hazır değil','Ürün fotoğrafının yüklenmesini kontrol edin ve tekrar deneyin.');
      return;
    }
    setSaving(true);
    try{
      if(!await Sharing.isAvailableAsync())throw Error('Bu cihazda paylaşım kullanılamıyor.');
      // Native iOS/Android snapshot writes directly to a temporary file.
      // No WKWebView, 8MB Base64 bridge, canvas.toDataURL or file JS write.
      const uri=await captureRef(posterRef,{
        format:'png',result:'tmpfile',
        width:1080,height:1920,quality:1,
      });
      if(!uri||typeof uri!=='string')throw Error('HD paylaşım görseli oluşturulamadı.');
      await Sharing.shareAsync(uri.startsWith('file://')?uri:'file://'+uri,{
        mimeType:'image/png',UTI:'public.png',
        dialogTitle:'Çalışkan B2B ürününü paylaş',
      });
    }catch(error){
      appAlert('Ürün paylaşılamadı',
        error instanceof Error?error.message:'Görsel hazırlanırken bir sorun oluştu.');
    }finally{setSaving(false);}
  }

  const shareAllowed=!!photo&&imageLoaded&&!imageFailed&&posterReady&&!saving;
  const appStore=verifiedBadge(badges.appStoreImage);
  const googlePlay=verifiedBadge(badges.googlePlayImage);

  return <Modal visible={visible} transparent animationType="slide"
    onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.backdrop}>
      <Pressable accessibilityLabel="Paylaşım penceresini kapat" style={{flex:1}} onPress={onClose}/>
      <View style={styles.sheet}>
        <View style={styles.handle}/>
        <View style={styles.header}>
          <Text style={styles.heading}>Ürünü paylaş</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={onClose}
            style={{padding:4}}><Ionicons name="close" size={25} color="#171717"/></Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{alignItems:'center',paddingBottom:25}}>
          {/* Render one small native view. It is NOT captured on modal open;
              capture happens only when the user taps Share. */}
          <View ref={posterRef} collapsable={false}
            onLayout={()=>setPosterReady(true)}
            style={[styles.poster,{width:posterWidth,height:posterWidth*16/9}]}>
            <View style={styles.posterHeader}>
              <View style={styles.brandLabel}>
                <Text style={styles.brandWord}>ÇALIŞKAN</Text>
                <Text style={styles.brandSuffix}>B2B</Text>
              </View>
              <View style={styles.brandAccent}/>
            </View>
            <View style={styles.hero}>
              {photo?<NativeImage key={photo} source={{uri:photo}}
                style={styles.productImage} resizeMode="contain"
                onLoad={()=>setImageLoaded(true)}
                onError={()=>{setImageFailed(true);setImageLoaded(false);}}/>:
                <Ionicons name="image-outline" size={40} color="#999"/>}
            </View>
            <View style={styles.details}>
              {!!product.brand&&<View style={styles.brandTag}><Text style={styles.brandText}
                numberOfLines={1}>{String(product.brand).slice(0,42)}</Text></View>}
              <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
              <View style={styles.separator}/>
              <View style={styles.facts}>
                {facts.map(([label,value],index)=><View key={label+'-'+index} style={styles.fact}>
                  <Text style={styles.factLabel} numberOfLines={1}>{label.toLocaleUpperCase('tr-TR')}</Text>
                  <Text style={styles.factValue} numberOfLines={1}>{value}</Text>
                </View>)}
              </View>
            </View>
            <View style={styles.download}>
              <View style={styles.appIcon}>
                {appIcon?<NativeImage source={{uri:appIcon}} resizeMode="contain"
                  style={{width:'100%',height:'100%'}}/>:
                  <Text style={{color:'#FFCB05',fontWeight:'900',fontSize:29}}>Ç</Text>}
              </View>
              <View style={{flex:1}}>
                <Text style={styles.downloadBrand}>ÇALIŞKAN B2B</Text>
                <Text style={styles.downloadTitle}>UYGULAMASINI İNDİR</Text>
              </View>
            </View>
            <View style={styles.stores}>
              {!!appStore&&<NativeImage source={{uri:appStore}} resizeMode="contain"
                style={styles.storeBadge}/>}
              {!!googlePlay&&<NativeImage source={{uri:googlePlay}} resizeMode="contain"
                style={styles.storeBadge}/>}
            </View>
            <Text style={styles.domain}>b2b.ecalisgan.com</Text>
          </View>
          <Text style={styles.note}>1080 × 1920 HD PNG · Fiyat gösterilmez</Text>
          {imageFailed&&<Text style={styles.error}>Ürün görseli yüklenemedi. Paylaşım için tekrar deneyin.</Text>}
          <Pressable accessibilityRole="button"
            onPress={()=>void share()} disabled={!shareAllowed}
            style={[styles.shareButton,{opacity:shareAllowed?1:.5}]}>
            {saving?<ActivityIndicator color="#171717"/>:
              <Ionicons name="share-social-outline" color="#171717" size={21}/>}
            <Text style={styles.shareLabel}>
              {saving?'Görsel hazırlanıyor…':imageFailed?'Görsel yüklenemedi':
                !imageLoaded?'Ürün görseli yükleniyor…':'Paylaş / Görseli Kaydet'}
            </Text>
          </Pressable>
          <Text style={styles.help}>Instagram, WhatsApp veya Fotoğraflar için paylaşım menüsünü kullanın.</Text>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles=StyleSheet.create({
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.57)'},
  sheet:{backgroundColor:'#FFFFFF',borderTopLeftRadius:26,borderTopRightRadius:26,
    paddingHorizontal:18,maxHeight:Dimensions.get('window').height*.88},
  handle:{width:42,height:5,borderRadius:5,backgroundColor:'#D1D1D1',
    alignSelf:'center',marginTop:10,marginBottom:12},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10},
  heading:{fontSize:19,fontWeight:'900',color:'#171717'},
  poster:{backgroundColor:'#FAFAF8',overflow:'hidden',
    borderWidth:1,borderColor:'#E6E6E6',borderRadius:9,paddingHorizontal:13},
  posterHeader:{height:'13%',justifyContent:'center',flexDirection:'row',alignItems:'center'},
  brandLabel:{backgroundColor:'#181818',borderRadius:8,width:'91%',
    height:42,justifyContent:'center',paddingLeft:14},
  brandWord:{fontSize:21,fontWeight:'900',color:'#FFCB05',letterSpacing:-.6},
  brandSuffix:{fontSize:10,fontWeight:'900',color:'#FFFFFF',position:'absolute',right:13},
  brandAccent:{position:'absolute',bottom:4,left:0,right:0,height:2,backgroundColor:'#FFCB05'},
  hero:{height:'42%',backgroundColor:'#FFFFFF',borderRadius:12,
    justifyContent:'center',alignItems:'center',padding:6},
  productImage:{height:'100%',width:'100%'},
  details:{marginTop:7,height:'24%',backgroundColor:'#FFFFFF',borderRadius:10,
    paddingHorizontal:10,paddingVertical:7},
  brandTag:{backgroundColor:'#171717',alignSelf:'flex-start',borderRadius:4,
    paddingHorizontal:6,paddingVertical:3,marginBottom:4,maxWidth:'100%'},
  brandText:{color:'#FFFFFF',fontSize:10,fontWeight:'800'},
  productName:{fontSize:15,fontWeight:'900',color:'#181818',lineHeight:18},
  separator:{height:1,backgroundColor:'#E6E6E6',marginVertical:4},
  facts:{flex:1,flexDirection:'row',flexWrap:'wrap',alignContent:'flex-start'},
  fact:{width:'50%',paddingRight:5,marginBottom:3},
  factLabel:{fontSize:7,color:'#737373',fontWeight:'700'},
  factValue:{fontSize:10,color:'#171717',fontWeight:'800'},
  download:{height:'11%',flexDirection:'row',backgroundColor:'#FFCB05',
    borderRadius:9,alignItems:'center',paddingHorizontal:10,marginTop:8,gap:9},
  appIcon:{width:37,height:37,borderRadius:7,backgroundColor:'#171717',
    justifyContent:'center',alignItems:'center',overflow:'hidden'},
  downloadBrand:{fontSize:11,color:'#181818',fontWeight:'900'},
  downloadTitle:{fontSize:13,color:'#181818',fontWeight:'900'},
  stores:{height:'5%',flexDirection:'row',justifyContent:'center',alignItems:'center',gap:9},
  storeBadge:{width:103,height:23},
  domain:{fontSize:8,color:'#737373',textAlign:'center',marginTop:1},
  note:{fontSize:11,color:'#686868',marginVertical:12,textAlign:'center'},
  error:{fontSize:11,color:'#B91C1C',textAlign:'center',marginBottom:7},
  shareButton:{backgroundColor:'#FFCB05',borderRadius:12,height:50,
    width:'100%',flexDirection:'row',gap:9,justifyContent:'center',alignItems:'center'},
  shareLabel:{fontSize:14,color:'#171717',fontWeight:'900'},
  help:{fontSize:11,color:'#747474',textAlign:'center',marginTop:9},
});
