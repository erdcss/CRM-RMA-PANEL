import {useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Dimensions,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {WebView} from 'react-native-webview';
import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {appAlert} from '@/lib/appAlert';
import {absoluteMediaUrl,API_BASE_URL,type B2BProduct} from '@/lib/api';

// Explicit whitelist: NEVER export prices, inventory, margin or supplier details.
export function shareFacts(p:B2BProduct):Array<[string,string]>{
  const raw:Array<[string,string]>=[
    ['Marka',p.brand||''],['Model / Kod',p.sku||''],['Kategori',p.category||''],
    ['Koli İçi',p.units_per_box?Math.max(1,Number(p.units_per_box))+' adet':''],
    ['Minimum Alım',p.min_order_qty?Math.max(1,Number(p.min_order_qty))+' koli':''],
    ...(p.features||[]).filter((s):s is string=>typeof s==='string'&&!/(?:₺|\bTL\b|\bfiyat\b|\bprice\b|\bkâr\b|\bmaliyet\b|\bindirim\b)/i.test(s)).slice(0,3).map(s=>['Özellik',s] as [string,string]),
  ];
  return raw.filter(x=>!!x[1]).map(([a,b]):[string,string]=>[a,b.replace(/\s+/g,' ').slice(0,78)]).slice(0,8);
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
function makePoster(p:B2BProduct,photo:string,appIcon:string,appStoreBadge:string,playBadge:string){
 const payload=JSON.stringify({
  name:String(p.name||'Ürün').replace(/\s+/g,' ').slice(0,105),
  brand:String(p.brand||'').trim().slice(0,48),
  facts:shareFacts(p).filter(([label])=>label!=='Marka').slice(0,6),
  photo,appIcon,appStoreBadge,playBadge,
 }).replace(/</g,'\\u003c').replace(/\u2028|\u2029/g,' ');
 return `<!doctype html><html lang="tr"><head><meta name="viewport" content="width=device-width"></head>
 <body style="margin:0;background:white"><canvas id="poster" width="1080" height="1920" style="width:1px;height:1px"></canvas>
 <script>
 (async function(){
 const data=${payload},c=document.getElementById('poster'),g=c.getContext('2d');
 const Y='#FFCB05',BLACK='#181818',MUTED='#636363';
 function box(x,y,w,h,r,color){g.fillStyle=color;g.beginPath();g.roundRect(x,y,w,h,r);g.fill();}
 function type(t,x,y,size,color=BLACK,weight='700',max=900){
  g.fillStyle=color;g.font=weight+' '+size+'px Arial,sans-serif';g.textBaseline='top';
  g.fillText(String(t),x,y,max);
 }
 function wrap(value,maxWidth,size,maxLines){
  g.font='800 '+size+'px Arial,sans-serif';
  const out=[];let line='';
  for(const word of String(value).split(/\s+/)){
   const candidate=line?line+' '+word:word;
   if(line&&g.measureText(candidate).width>maxWidth){out.push(line);line=word;}else line=candidate;
  }
  if(line)out.push(line);
  return out.slice(0,maxLines);
 }
 function openImage(src){return new Promise(ok=>{
  if(!src)return ok(null);
  const i=new Image();i.onload=()=>ok(i);i.onerror=()=>ok(null);i.src=src;
 });}
 function contain(im,x,y,w,h){
  const s=Math.min(w/im.width,h/im.height);
  const ww=im.width*s,hh=im.height*s;
  g.drawImage(im,x+(w-ww)/2,y+(h-hh)/2,ww,hh);
 }
 function icon(label,x,y){
  box(x,y,72,72,19,Y);g.strokeStyle=BLACK;g.lineWidth=4.5;
  g.lineCap='round';g.lineJoin='round';g.beginPath();
  if(label==='Model / Kod'){
   g.moveTo(x+16,y+25);g.lineTo(x+34,y+13);g.lineTo(x+56,y+25);
   g.lineTo(x+56,y+48);g.lineTo(x+34,y+60);g.lineTo(x+16,y+48);g.closePath();
  }else if(label==='Koli İçi'||label==='Minimum Alım'){
   g.rect(x+17,y+21,38,34);g.moveTo(x+17,y+32);g.lineTo(x+55,y+32);
  }else{
   g.arc(x+36,y+36,17,0,Math.PI*2);
  }
  g.stroke();
 }
 // Brand signature and sweeping golden ribbon. Safe margins >=80px.
 const imgs=await Promise.all([openImage(data.photo),openImage(data.appIcon),
   openImage(data.appStoreBadge),openImage(data.playBadge)]);
 const [product,app,appStore,google]=imgs;
 if(!product){window.ReactNativeWebView.postMessage(JSON.stringify({kind:'error',message:'Ürün görseli alınamadı'}));return;}
 g.fillStyle='#FEFEFD';g.fillRect(0,0,1080,1920);
 g.fillStyle='#1B1B1B';g.beginPath();g.moveTo(0,0);g.lineTo(494,0);
 g.quadraticCurveTo(459,83,394,159);g.quadraticCurveTo(338,235,0,269);g.closePath();g.fill();
 g.strokeStyle=Y;g.lineWidth=6;g.beginPath();g.moveTo(510,0);
 g.bezierCurveTo(392,197,383,201,0,278);g.stroke();
 box(75,53,350,113,32,Y);
 type('ÇALIŞKAN',107,75,53,'#0C0C0C','900',290);
 type('B2B',303,121,27,'#0C0C0C','900',72);
 // A layered, restrained halo behind the original photograph.
 g.fillStyle='#FFCB0524';g.beginPath();g.ellipse(570,678,477,474,0,0,Math.PI*2);g.fill();
 g.strokeStyle='#FFCB05';g.lineWidth=35;g.globalAlpha=.55;
 g.beginPath();g.ellipse(550,692,469,431,-.16,0,Math.PI*2);g.stroke();g.globalAlpha=1;
 g.save();g.shadowColor='rgba(0,0,0,.10)';g.shadowBlur=33;g.shadowOffsetY=12;
 box(86,307,908,805,35,'#FFFFFF');g.restore();
 contain(product,118,328,844,760);
 // Product's brand wordmark comes from the real catalog, not an invented mark.
 g.save();g.shadowColor='rgba(0,0,0,.10)';g.shadowBlur=24;g.shadowOffsetY=6;
 box(75,1140,930,494,35,'#FFFFFF');g.restore();
 if(data.brand){
  g.font='900 44px Arial,sans-serif';
  const badgeW=Math.min(340,Math.max(145,g.measureText(data.brand).width+64));
  box(112,1181,badgeW,75,15,'#1B1B1B');
  type(data.brand,142,1192,42,'#FFFFFF','900',badgeW-45);
 }
 const nameStart=data.brand?1289:1195;
 wrap(data.name,855,53,2).forEach((line,j)=>type(line,115,nameStart+j*63,53,BLACK,'900',855));
 const sepY=data.brand?1429:1343;
 g.fillStyle='#E9E9E9';g.fillRect(115,sepY,850,2);
 const facts=data.facts.slice(0,6),factsY=sepY+25;
 facts.forEach(([label,value],i)=>{
  const col=i%2,row=Math.floor(i/2);
  const x=115+col*429,y=factsY+row*67;
  icon(label,x,y);
  type(label.toLocaleUpperCase('tr-TR'),x+90,y+6,18,'#686868','700',320);
  type(value,x+90,y+31,26,BLACK,'800',320);
 });
 // Bottom call-to-action with centrally uploaded app icon.
 box(75,1660,930,139,31,Y);
 if(app){
  box(110,1679,101,101,23,'#181818');
  contain(app,115,1684,91,91);
 }else{box(110,1679,101,101,23,'#181818');type('Ç',141,1700,59,Y);}
 type('ÇALIŞKAN B2B',238,1688,35,BLACK,'900',655);
 type('UYGULAMASINI İNDİR',238,1734,41,BLACK,'900',690);
 // Use ONLY actual admin-uploaded App Store and Google Play badge artwork.
 if(appStore||google){
  if(appStore&&google){contain(appStore,272,1812,258,61);contain(google,543,1812,258,61);}
  else if(appStore)contain(appStore,420,1812,255,61);
  else contain(google,420,1812,255,61);
 }
 type('b2b.ecalisgan.com',384,1876,23,'#777777','600',335);
 window.ReactNativeWebView.postMessage(JSON.stringify({kind:'done',
   png:c.toDataURL('image/png').split(',')[1]}));
 })().catch(e=>window.ReactNativeWebView.postMessage(JSON.stringify({kind:'error',message:String(e)})));
 </script></body></html>`;
}
export function ProductShareSheet({product,imageUri,logoUri,visible,onClose}:{product:B2BProduct;imageUri?:string|null;logoUri?:string|null;visible:boolean;onClose:()=>void}){
 const [html,setHtml]=useState(''),[file,setFile]=useState(''),[busy,setBusy]=useState(false);
 const facts=useMemo(()=>shareFacts(product),[product]);
 useEffect(()=>{if(!visible)return;let active=true;setFile('');setHtml('');setBusy(true);
 Promise.all([
  dataImage(imageUri),
  dataImage(logoUri),
  fetch(API_BASE_URL+'/api/public/b2b-footer',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)})
    .then(r=>r.ok?r.json():{}).catch(()=>({}))
 ]).then(async ([photo,appIcon,links])=>{
  const badges=links as {appStoreImage?:string;googlePlayImage?:string};
  const [appStore,googlePlay]=await Promise.all([dataImage(badges.appStoreImage),dataImage(badges.googlePlayImage)]);
  if(!active)return;
  if(!photo)throw Error('Ürün fotoğrafı yüklenemedi; eksik görselle paylaşım yapılamaz');
  setHtml(makePoster(product,photo,appIcon,appStore,googlePlay));
 }).catch(error=>{if(active){setBusy(false);appAlert('Görsel hazırlanamadı',error instanceof Error?error.message:'Görsel hazırlanamadı.');}});
 return ()=>{active=false;};},[visible,product,imageUri,logoUri]);
 async function share(){if(!file)return;try{if(!await Sharing.isAvailableAsync())throw Error('Paylaşım kullanılamıyor.');
 await Sharing.shareAsync(file,{mimeType:'image/png',UTI:'public.png',dialogTitle:'Çalışkan B2B ürününü paylaş'});}
 catch(e){appAlert('Paylaşım başarısız',e instanceof Error?e.message:'Tekrar deneyin.');}}
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
 <View style={st.backdrop}><Pressable style={{flex:1}} onPress={onClose}/>
 <View style={st.sheet}><View style={st.handle}/><View style={st.header}>
 <Text style={st.title}>Ürünü paylaş</Text><Pressable accessibilityLabel="Kapat" onPress={onClose}><Ionicons name="close" color="#171717" size={26}/></Pressable></View>
 <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:24}}>
 <View style={st.poster}>
 {file?<Image source={{uri:file}} style={{width:'100%',height:'100%'}} contentFit="contain"/>:
 <View style={{flex:1,padding:11}}>
  <View style={st.mark}><Text style={{color:'#FFCB05',fontWeight:'900',fontSize:13}}>ÇALIŞKAN B2B</Text></View>
  <View style={st.imageArea}>{imageUri?<Image source={{uri:imageUri}} style={{width:'100%',height:'100%'}} contentFit="contain"/>:<Ionicons name="image-outline" size={42} color="#aaa"/>}</View>
  <View style={st.detail}><Text numberOfLines={2} style={st.productTitle}>{product.name}</Text>{facts.slice(0,5).map(([a,b],i)=><Text key={i} style={st.fact} numberOfLines={1}>{a}: {b}</Text>)}</View>
  <View style={st.cta}><Text style={{color:'#171717',fontWeight:'900',fontSize:12}}>ÇALIŞKAN B2B UYGULAMASINI İNDİR</Text></View>
 </View>}</View>
 <Text style={st.note}>1080 × 1920 HD PNG · Fiyatsız · Instagram Reels/Hikâye için uygun</Text>
 <Pressable onPress={()=>void share()} disabled={!file||busy} style={[st.action,{opacity:file&&!busy?1:.5}]}>
 {busy?<ActivityIndicator color="#171717"/>:<Ionicons name="share-social" color="#171717" size={21}/>}
 <Text style={{fontWeight:'900',fontSize:15,color:'#171717'}}>{busy?'HD tasarım hazırlanıyor…':'Paylaş / Görseli Kaydet'}</Text></Pressable>
 <Text style={st.help}>Instagram, WhatsApp veya galeriyi iOS paylaşım menüsünden seçebilirsiniz.</Text></ScrollView>
 {!!html&&busy&&<WebView originWhitelist={['*']} source={{html,baseUrl:'https://b2b.ecalisgan.com'}} style={{position:'absolute',width:1,height:1,opacity:0}} javaScriptEnabled onMessage={async e=>{
 try{const v=JSON.parse(e.nativeEvent.data);if(v.kind!=='done'||!v.png)throw Error(v.message||'PNG oluşturulamadı');
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
 poster:{width:208,aspectRatio:9/16,alignSelf:'center',borderRadius:14,borderWidth:1,borderColor:'#e3e3e3',overflow:'hidden',backgroundColor:'#fafaf8'},
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
