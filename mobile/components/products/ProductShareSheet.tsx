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
function makePoster(p:B2BProduct,photo:string,logo:string){
 const payload=JSON.stringify({
   name:String(p.name||'Ürün').replace(/\s+/g,' ').slice(0,100),
   facts:shareFacts(p),photo,logo,
 }).replace(/</g,'\u003c');
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head>
 <body style="margin:0;background:#fff"><canvas id="c" width="1080" height="1920" style="width:1px;height:1px"></canvas>
 <script>
 const data=${payload},c=document.getElementById('c'),g=c.getContext('2d');
 function box(x,y,w,h,r,color){g.fillStyle=color;g.beginPath();g.roundRect(x,y,w,h,r);g.fill();}
 function txt(t,x,y,size,color='#181818',bold=true,max=850){
   g.fillStyle=color;g.font=(bold?'700 ':'400 ')+size+'px Arial,sans-serif';
   g.textBaseline='top';g.fillText(String(t),x,y,max);
 }
 function image(src){return new Promise(resolve=>{
   if(!src)return resolve(null);const img=new Image();
   img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;
 });}
 function lines(text,maxWidth,maxLines,size){
   g.font='700 '+size+'px Arial,sans-serif';
   const words=text.split(' '),out=[];let line='';
   for(const word of words){
     const next=line?line+' '+word:word;
     if(line&&g.measureText(next).width>maxWidth){out.push(line);line=word;}
     else line=next;
   }
   if(line)out.push(line);
   return out.slice(0,maxLines);
 }
 Promise.all([image(data.photo),image(data.logo)]).then(([photo,logo])=>{
   // Reels-safe editorial card: 105px sides, 100px top, 120px bottom.
   g.fillStyle='#F9F9F7';g.fillRect(0,0,1080,1920);
   box(0,0,1080,18,0,'#FFCC05');
   box(100,96,880,134,26,'#171717');
   box(125,114,120,98,18,'#FFCC05');
   if(logo){
     const scale=Math.min(106/logo.width,86/logo.height);
     g.drawImage(logo,185-logo.width*scale/2,163-logo.height*scale/2,logo.width*scale,logo.height*scale);
   }else txt('Ç',164,135,62,'#111');
   txt('ÇALIŞKAN B2B',276,145,48,'#FFFFFF',true,645);
   box(100,262,880,884,34,'#FFFFFF');
   if(photo){
     const scale=Math.min(780/photo.width,780/photo.height);
     g.drawImage(photo,540-photo.width*scale/2,704-photo.height*scale/2,
       photo.width*scale,photo.height*scale);
   }else txt('ÜRÜN GÖRSELİ',330,665,45,'#888');
   box(100,1175,880,472,32,'#FFFFFF');
   box(140,1211,8,84,4,'#FFCC05');
   const nameLines=lines(data.name,770,2,49);
   nameLines.forEach((line,index)=>txt(line,173,1210+index*60,49,'#151515'));
   g.fillStyle='#E9E9E7';g.fillRect(140,1343,800,2);
   const facts=data.facts.slice(0,8);
   facts.forEach((fact,index)=>{
     const col=index%2,row=Math.floor(index/2);
     const x=144+col*405,y=1374+row*62;
     txt(fact[0].toLocaleUpperCase('tr-TR'),x,y,17,'#727272',true,360);
     txt(fact[1],x,y+24,26,'#151515',true,360);
   });
   box(100,1678,880,121,28,'#FFCC05');
   txt('ÇALIŞKAN B2B UYGULAMASINI İNDİR',143,1718,34,'#161616',true,786);
   txt('b2b.ecalisgan.com',376,1831,26,'#727272',false,350);
   window.ReactNativeWebView.postMessage(JSON.stringify({
     kind:'done',png:c.toDataURL('image/png').split(',')[1]
   }));
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
