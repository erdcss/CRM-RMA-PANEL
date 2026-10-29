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
import {SHARE_POSTER_RULES} from './share-poster-rules';

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
type ShareAssets={appIcon?:string|null;appStoreBadge?:string|null;googlePlayBadge?:string|null};
function adminShareImage(value:unknown):string|null {
  if(typeof value!=='string'||!value.trim())return null;
  const url=value.trim();
  // Admin returns small image routes, never raw base64 images to the app.
  if(url.startsWith('/api/public/'))return BRANDING_API+url;
  if(/^https:\/\/[^\s]+$/i.test(url))return url;
  return null;
}

export function ProductShareSheet({
  product,imageUri,visible,onClose,
}:{
  product:B2BProduct;imageUri?:string|null;
  visible:boolean;onClose:()=>void;
}){
  const posterRef=useRef<View>(null);
  const [saving,setSaving]=useState(false);
  const [posterReady,setPosterReady]=useState(false);
  const [imageLoaded,setImageLoaded]=useState(false);
  const [imageFailed,setImageFailed]=useState(false);
  const [assets,setAssets]=useState<ShareAssets>({});
  const [assetsReady,setAssetsReady]=useState(false);
  const [assetsError,setAssetsError]=useState('');
  const [loadedAssets,setLoadedAssets]=useState({app:false,apple:false,google:false});
  const facts=useMemo(()=>shareFacts(product),[product]);
  const photo=absoluteMediaUrl(imageUri);
  const appIcon=adminShareImage(assets.appIcon);
  const appStore=adminShareImage(assets.appStoreBadge);
  const googlePlay=adminShareImage(assets.googlePlayBadge);
  const allAssetsLoaded=(!appIcon||loadedAssets.app)&&
    (!appStore||loadedAssets.apple)&&(!googlePlay||loadedAssets.google);
  const brandingReady=assetsReady&&!assetsError&&allAssetsLoaded;
  const posterWidth=Math.min(POSTER_WIDTH,Dimensions.get('window').width-64);

  useEffect(()=>{
    if(!visible)return;
    setSaving(false);
    setPosterReady(false);
    setImageLoaded(false);
    setImageFailed(false);
    setAssets({});
    setAssetsReady(false);
    setAssetsError('');
    setLoadedAssets({app:false,apple:false,google:false});
    let active=true;
    const controller=new AbortController();
    // Every opening reads saved admin assets again; a new admin upload changes
    // the next product share, without another native iOS / Android build.
    fetch(BRANDING_API+'/api/public/b2b-share-assets',{
      signal:controller.signal,
      headers:{'Accept':'application/json','Cache-Control':'no-cache'}
    })
      .then(async response=>{
        if(!response.ok)throw Error('Uygulama logo ve mağaza görselleri alınamadı');
        return response.json() as Promise<ShareAssets>;
      })
      .then(value=>{if(active){setAssets(value||{});setAssetsReady(true);}})
      .catch(error=>{
        if(active){setAssetsError(error instanceof Error?error.message:'Görseller alınamadı');setAssetsReady(true);}
      });
    return ()=>{active=false;controller.abort();};
  },[visible,product.id]);

  async function share(){
    if(saving)return;
    if(!photo||imageFailed||!imageLoaded||!posterReady||!brandingReady||!posterRef.current){
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
        width:SHARE_POSTER_RULES.output.width,height:SHARE_POSTER_RULES.output.height,quality:1,
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

  const shareAllowed=!!photo&&imageLoaded&&!imageFailed&&posterReady&&brandingReady&&!saving;

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
                {!!appIcon && <NativeImage source={{uri:appIcon}}
                  resizeMode="contain" style={styles.headerAppIcon}/>}
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
              {!!product.brand&&<View style={styles.brandTag}>
                <Text style={styles.brandText} numberOfLines={1}>{String(product.brand).slice(0,42)}</Text>
              </View>}
              <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
              <View style={styles.facts}>
                {facts.map(([label,value],index)=><View key={label+'-'+index} style={styles.fact}>
                  <Text style={styles.factLabel} numberOfLines={1}>{label.toLocaleUpperCase('tr-TR')}</Text>
                  <Text style={styles.factValue} numberOfLines={2}>{value}</Text>
                </View>)}
              </View>
            </View>
            <View style={styles.download}>
              <View style={styles.appIcon}>
                {appIcon?<NativeImage key={appIcon} source={{uri:appIcon}} resizeMode="contain"
                  onLoad={()=>setLoadedAssets(previous=>({...previous,app:true}))}
                  onError={()=>setAssetsError('Ayarlar’daki uygulama logosu yüklenemedi')}
                  style={{width:'100%',height:'100%'}}/>:
                  <Text style={{color:'#FFCB05',fontWeight:'900',fontSize:24}}>Ç</Text>}
              </View>
              <View style={{flex:1}}>
                <Text style={styles.downloadBrand}>ÇALIŞKAN B2B</Text>
                <Text style={styles.downloadTitle}>UYGULAMASINI İNDİR</Text>
              </View>
            </View>
            <View style={styles.stores}>
              {!!appStore&&<View style={styles.storeBox}>
                <NativeImage key={appStore} source={{uri:appStore}} resizeMode="contain"
                  onLoad={()=>setLoadedAssets(previous=>({...previous,apple:true}))}
                  onError={()=>setAssetsError('App Store rozet görseli yüklenemedi')}
                  style={styles.storeBadge}/>
              </View>}
              {!!googlePlay&&<View style={styles.storeBox}>
                <NativeImage key={googlePlay} source={{uri:googlePlay}} resizeMode="contain"
                  onLoad={()=>setLoadedAssets(previous=>({...previous,google:true}))}
                  onError={()=>setAssetsError('Google Play rozet görseli yüklenemedi')}
                  style={styles.storeBadge}/>
              </View>}
            </View>
            <Text style={styles.domain}>b2b.ecalisgan.com</Text>
          </View>
          <Text style={styles.note}>1080 × 1920 HD PNG · Fiyat gösterilmez</Text>
          {imageFailed&&<Text style={styles.error}>Ürün görseli yüklenemedi. Paylaşım için tekrar deneyin.</Text>}
          {!!assetsError&&<Text style={styles.error}>{assetsError}. Ayarlar’daki görseli kontrol edin.</Text>}
          <Pressable accessibilityRole="button"
            onPress={()=>void share()} disabled={!shareAllowed}
            style={[styles.shareButton,{opacity:shareAllowed?1:.5}]}>
            {saving?<ActivityIndicator color="#171717"/>:
              <Ionicons name="share-social-outline" color="#171717" size={21}/>}
            <Text style={styles.shareLabel}>
              {saving?'Görsel hazırlanıyor…':imageFailed?'Görsel yüklenemedi':
                !imageLoaded?'Ürün görseli yükleniyor…':
                !brandingReady?(assetsError?'Mağaza görselleri yüklenemedi':'Marka görselleri yükleniyor…'):
                'Paylaş / Görseli Kaydet'}
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
  poster:{backgroundColor:'#F5F5F3',overflow:'hidden',borderWidth:1,borderColor:'#E6E6E6',
    borderRadius:12,paddingHorizontal:10,paddingTop:9,paddingBottom:6},
  posterHeader:{height:49,marginBottom:4,justifyContent:'center'},
  brandLabel:{backgroundColor:'#181818',borderRadius:10,width:'100%',height:43,
    flexDirection:'row',alignItems:'center',paddingHorizontal:11,gap:8},
  headerAppIcon:{width:33,height:33,borderRadius:7},
  brandWord:{fontSize:20,fontWeight:'900',color:'#FFCB05',letterSpacing:-.5,flexShrink:1},
  brandSuffix:{fontSize:10,fontWeight:'900',color:'#FFFFFF',marginLeft:'auto'},
  brandAccent:{height:2,backgroundColor:'#FFCB05',borderRadius:3,position:'absolute',
    left:0,right:0,bottom:0},
  hero:{height:160,backgroundColor:'#FFFFFF',borderRadius:12,
    justifyContent:'center',alignItems:'center',padding:7,marginBottom:6},
  productImage:{width:'100%',height:'100%'},
  details:{height:142,backgroundColor:'#FFFFFF',borderRadius:11,
    paddingHorizontal:8,paddingVertical:6,marginBottom:6},
  brandTag:{backgroundColor:'#171717',alignSelf:'flex-start',borderRadius:5,
    paddingHorizontal:7,paddingVertical:2,marginBottom:3,maxWidth:'95%'},
  brandText:{fontSize:9,color:'#FFFFFF',fontWeight:'800'},
  productName:{fontSize:14,lineHeight:16,fontWeight:'900',color:'#181818',marginBottom:4},
  facts:{flex:1,flexDirection:'row',flexWrap:'wrap',gap:4,alignContent:'flex-start'},
  fact:{width:'49%',minHeight:29,backgroundColor:'#F5F5F5',
    borderWidth:1,borderColor:'#E9E9E9',borderRadius:6,paddingHorizontal:6,paddingVertical:3},
  factLabel:{fontSize:6.5,color:'#707070',fontWeight:'700'},
  factValue:{fontSize:9.5,lineHeight:11,color:'#151515',fontWeight:'900'},
  download:{height:44,flexDirection:'row',alignItems:'center',backgroundColor:'#FFCB05',
    borderRadius:10,paddingHorizontal:9,gap:8,marginBottom:5},
  appIcon:{width:34,height:34,borderRadius:7,backgroundColor:'#171717',
    justifyContent:'center',alignItems:'center',overflow:'hidden'},
  downloadBrand:{fontSize:10,color:'#171717',fontWeight:'900'},
  downloadTitle:{fontSize:12,color:'#171717',fontWeight:'900'},
  stores:{height:33,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:10},
  storeBox:{width:'46%',height:31,backgroundColor:'#FFFFFF',borderWidth:1,
    borderColor:'#E2E2E2',borderRadius:7,alignItems:'center',justifyContent:'center',padding:3},
  storeBadge:{width:'96%',height:'96%'},
  domain:{fontSize:8,color:'#707070',textAlign:'center',marginTop:3},
  note:{fontSize:11,color:'#686868',marginVertical:12,textAlign:'center'},
  error:{fontSize:11,color:'#B91C1C',textAlign:'center',marginBottom:7},
  shareButton:{backgroundColor:'#FFCB05',borderRadius:12,height:50,width:'100%',
    flexDirection:'row',gap:9,justifyContent:'center',alignItems:'center'},
  shareLabel:{fontSize:14,color:'#171717',fontWeight:'900'},
  help:{fontSize:11,color:'#747474',textAlign:'center',marginTop:9},
});
