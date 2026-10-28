import {useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Dimensions,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {WebView} from 'react-native-webview';
import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {appAlert} from '@/lib/appAlert';
import {absoluteMediaUrl,type B2BProduct} from '@/lib/api';

// Explicit whitelist: NEVER export prices, inventory, margin or supplier details.
export function shareFacts(p:B2BProduct):Array<[string,string]>{
  const raw:Array<[string,string]>=[
    ['Marka',p.brand||''],['Model / Kod',p.sku||''],['Kategori',p.category||''],
    ['Koli İçi',p.units_per_box?Math.max(1,Number(p.units_per_box))+' adet':''],
    ['Minimum Alım',p.min_order_qty?Math.max(1,Number(p.min_order_qty))+' koli':''],
    ...(p.features||[]).filter((s):s is string=>typeof s==='string').slice(0,3).map(s=>['Özellik',s] as [string,string]),
  ];
  return raw.filter(x=>!!x[1]).map(([a,b])=>[a,b.replace(/\s+/g,' ').slice(0,78)]).slice(0,8);
}
async function dataImage(src?:string|null):Promise<string>{
  const url=absoluteMediaUrl(src);
  if(!url)return '';
  if(/^data:image\/(?:png|jpeg|webp);base64,/i.test(url))return url;
  if(!url.startsWith('https://'))return '';
  const path=FS.cacheDirectory+'b2b-share-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  try{
    const result=await FS.downloadAsync(url,path);
    if(result.status!==200)return '';
    const b64=await FS.readAsStringAsync(path,{encoding:FS.EncodingType.Base64});
    if(b64.length>12_000_000)return '';
    const mime=url.toLowerCase().includes('.png')?'png':url.toLowerCase().includes('.webp')?'webp':'jpeg';
    return 'data:image/'+mime+';base64,'+b64;
  }catch{return '';}finally{await FS.deleteAsync(path,{idempotent:true}).catch(()=>{});}
}
function makePoster(p:B2BProduct,photo:string,logo:string){
 const payload=JSON.stringify({name:String(p.name||'Ürün').replace(/\s+/g,' ').slice(0,100),facts:shareFacts(p),photo,logo}).replace(/</g,'\\u003c');
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0"><canvas id="c" width="1080" height="1920" style="width:1px;height:1px"></canvas><script>
 const data=${payload}, c=document.getElementById('c'),g=c.getContext('2d');
 function box(x,y,w,h,r,color){g.fillStyle=color;g.beginPath();g.roundRect(x,y,w,h,r);g.fill();}
 function txt(t,x,y,size,color='#161616',bold=true,width=820){g.fillStyle=color;g.font=(bold?'bold ':'')+size+'px Arial';g.textBaseline='top';g.fillText(String(t),x,y,width);}
 function image(src){return new Promise(ok=>{if(!src)return ok(null);let im=new Image();im.onload=()=>ok(im);im.onerror=()=>ok(null);im.src=src;});}
 Promise.all([image(data.photo),image(data.logo)]).then(([photo,logo])=>{
 g.fillStyle='#fff';g.fillRect(0,0,1080,1920);g.fillStyle='#FFCB05';g.fillRect(0,0,1080,14);
 box(88,86,904,128,28,'#171717');
 if(logo){let s=Math.min(330/logo.width,94/logo.height);g.drawImage(logo,118,102,logo.width*s,logo.height*s);}
 else txt('ÇALIŞKAN B2B',118,132,45,'#FFCB05');
 txt('ÜRÜN TANITIMI',720,138,26,'#fff',true,225);
 box(88,250,904,895,36,'#F5F5F5');
 if(photo){let s=Math.min(805/photo.width,805/photo.height);g.drawImage(photo,540-photo.width*s/2,690-photo.height*s/2,photo.width*s,photo.height*s);}
 else txt('Görsel bulunamadı',335,700,42);
 box(88,1183,904,444,34,'#F7F7F7');
 const words=data.name.split(' ');let line='',row=0;
 for(const word of words){let next=line?line+' '+word:word;g.font='bold 47px Arial';
 if(g.measureText(next).width>810&&line){txt(line,129,1230+row*57,47);row++;line=word;if(row===1)break;}else{line=next;}}
 txt(line,129,1230+row*57,47);
 data.facts.slice(0,8).forEach((fact,i)=>{let x=129+(i%2)*416,y=1387+Math.floor(i/2)*59;txt(fact[0].toUpperCase(),x,y,17,'#777');txt(fact[1],x,y+21,26,'#181818',true,382);});
 box(88,1680,904,126,28,'#FFCB05');
 txt('ÇALIŞKAN B2B',130,1705,28);txt('UYGULAMASINI İNDİR',130,1743,42);
 txt('b2b.ecalisgan.com',338,1850,24,'#777');
 window.ReactNativeWebView.postMessage(JSON.stringify({kind:'done',png:c.toDataURL('image/png').split(',')[1]}));
 }).catch(()=>window.ReactNativeWebView.postMessage(JSON.stringify({kind:'error'})));
 </script></body></html>`;
}
export function ProductShareSheet({product,imageUri,logoUri,visible,onClose}:{product:B2BProduct;imageUri?:string|null;logoUri?:string|null;visible:boolean;onClose:()=>void}){
 const [html,setHtml]=useState(''),[file,setFile]=useState(''),[busy,setBusy]=useState(false);
 const facts=useMemo(()=>shareFacts(product),[product]);
 useEffect(()=>{if(!visible)return;let active=true;setFile('');setHtml('');setBusy(true);
 Promise.all([dataImage(imageUri),dataImage(logoUri)]).then(([photo,logo])=>{if(active)setHtml(makePoster(product,photo,logo));}).catch(()=>{if(active){setBusy(false);appAlert('Görsel hazırlanamadı','Ürün fotoğrafı alınamadı.');}});
 return ()=>{active=false;};},[visible,product,imageUri,logoUri]);
 async function share(){if(!file)return;try{if(!await Sharing.isAvailableAsync())throw Error('Paylaşım kullanılamıyor.');
 await Sharing.shareAsync(file,{mimeType:'image/png',UTI:'public.png',dialogTitle:'Çalışkan B2B ürününü paylaş'});}
 catch(e){appAlert('Paylaşım başarısız',e instanceof Error?e.message:'Tekrar deneyin.');}}
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
 <View style={st.backdrop}><Pressable style={{flex:1}} onPress={onClose}/>
 <View style={st.sheet}><View style={st.handle}/><View style={st.header}>
 <Text style={st.title}>Ürünü paylaş</Text><Pressable accessibilityLabel="Kapat" onPress={onClose}><Ionicons name="close" color="#171717" size={26}/></Pressable></View>
 <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:24}}>
 <View style={st.poster}><View style={st.mark}><Text style={{color:'#FFCB05',fontWeight:'900',fontSize:13}}>ÇALIŞKAN B2B</Text></View>
 <View style={st.imageArea}>{imageUri?<Image source={{uri:imageUri}} style={{width:'100%',height:'100%'}} contentFit="contain"/>:<Ionicons name="image-outline" size={42} color="#aaa"/>}</View>
 <View style={st.detail}><Text numberOfLines={2} style={st.productTitle}>{product.name}</Text>{facts.slice(0,5).map(([a,b],i)=><Text key={i} style={st.fact} numberOfLines={1}>{a}: {b}</Text>)}</View>
 <View style={st.cta}><Text style={{color:'#171717',fontWeight:'900',fontSize:12}}>ÇALIŞKAN B2B UYGULAMASINI İNDİR</Text></View></View>
 <Text style={st.note}>1080 × 1920 HD PNG · Fiyatsız · Instagram Reels/Hikâye için uygun</Text>
 <Pressable onPress={()=>void share()} disabled={!file||busy} style={[st.action,{opacity:file&&!busy?1:.5}]}>
 {busy?<ActivityIndicator color="#171717"/>:<Ionicons name="share-social" color="#171717" size={21}/>}
 <Text style={{fontWeight:'900',fontSize:15,color:'#171717'}}>{busy?'HD tasarım hazırlanıyor…':'Paylaş / Görseli Kaydet'}</Text></Pressable>
 <Text style={st.help}>Instagram, WhatsApp veya galeriyi iOS paylaşım menüsünden seçebilirsiniz.</Text></ScrollView>
 {!!html&&busy&&<WebView originWhitelist={['*']} source={{html,baseUrl:'https://b2b.ecalisgan.com'}} style={{position:'absolute',width:1,height:1,opacity:0}} javaScriptEnabled onMessage={async e=>{
 try{const v=JSON.parse(e.nativeEvent.data);if(v.kind!=='done'||!v.png)throw Error('PNG oluşturulamadı');
 const path=FS.cacheDirectory+'caliskan-b2b-share-'+Date.now()+'.png';await FS.writeAsStringAsync(path,v.png,{encoding:FS.EncodingType.Base64});setFile(path);
 }catch(error){appAlert('Görsel üretilemedi',error instanceof Error?error.message:'Lütfen tekrar deneyin.');}
 finally{setBusy(false);}
 }}/>}
 </View></View></Modal>;
}
const st=StyleSheet.create({
 backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.6)'},
 sheet:{backgroundColor:'#fff',borderTopLeftRadius:26,borderTopRightRadius:26,paddingHorizontal:20,maxHeight:Dimensions.get('window').height*.82},
 handle:{width:44,height:5,borderRadius:3,backgroundColor:'#ccc',alignSelf:'center',marginTop:9,marginBottom:15},
 header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10},
 title:{fontSize:19,fontWeight:'900',color:'#171717'},
 poster:{width:193,aspectRatio:9/16,alignSelf:'center',borderRadius:12,borderWidth:1,borderColor:'#eee',padding:10,backgroundColor:'#fff'},
 mark:{padding:9,borderRadius:5,backgroundColor:'#171717',alignSelf:'flex-start'},
 imageArea:{flex:1,backgroundColor:'#f7f7f7',borderRadius:7,marginVertical:9,justifyContent:'center',alignItems:'center'},
 detail:{borderRadius:7,backgroundColor:'#f6f6f6',padding:8},
 productTitle:{fontSize:10,color:'#161616',fontWeight:'900'},
 fact:{fontSize:8,color:'#555',marginTop:3},
 cta:{backgroundColor:'#FFCB05',padding:8,alignItems:'center',borderRadius:6,marginTop:9},
 note:{fontSize:11,color:'#555',textAlign:'center',marginVertical:13},
 action:{height:50,borderRadius:12,backgroundColor:'#FFCB05',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8},
 help:{fontSize:11,textAlign:'center',marginTop:9,color:'#777'},
});
