import {useMemo,useState} from 'react';
import {ActivityIndicator,Alert,Image,Pressable,ScrollView,StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {useRouter} from 'expo-router';
import {useAuth} from '@/contexts/AuthContext';
import {localAuth} from '@/lib/supabase';

const ADMIN_API=(process.env.EXPO_PUBLIC_BRANDING_API_URL||'https://admin.ecalisgan.com').replace(/\/$/,'');
const fields=[
  ['name','Ürün adı'],['sku','Stok kodu (SKU)'],['barcode','Barkod'],['brand','Marka'],
  ['model','Model'],['category','Kategori'],['collectionName','Koleksiyon'],
  ['color','Renk'],['material','Malzeme'],['size','Ölçü'],['tags','Etiketler (virgülle)'],
  ['description','Açıklama'],['price','Satış fiyatı (TL)'],['stock','Stok'],
  ['unitsPerBox','Koli içi adet'],['minOrderQty','Minimum sipariş (koli)'],
  ['leadDays','Termin (gün)']
] as const;
type Key=typeof fields[number][0];
type Draft=Record<Key,string>;
const makeDraft=()=>Object.fromEntries(fields.map(([key])=>[key,''])) as Draft;
type AIProduct={product:Record<string,string>};
type RenderResult={image:string};
type SaveResult={productId:number|string;isLive:boolean;message:string};
const numericKeys=['price','stock','unitsPerBox','minOrderQty','leadDays'] as const;
async function adminPost<T>(route:string,body:Record<string,unknown>):Promise<T>{
  const {token}=await localAuth.getRequestCredentials();
  if(!token)throw new Error('Önce giriş yapın.');
  const response=await fetch(ADMIN_API+route,{
    method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify(body),
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(json.error||'Sunucu hatası ('+response.status+')');
  return json as T;
}
const parseNum=(value:string)=>Number(value.trim().replace(',','.'));
export default function AiProductStudio(){
  const router=useRouter();
  const {user}=useAuth();
  const allowed=user?.role==='super_admin'||user?.role==='b2b_seller';
  const [photos,setPhotos]=useState<string[]>([]);
  const [draft,setDraft]=useState<Draft>(makeDraft);
  const [analyzing,setAnalyzing]=useState(false);
  const [editing,setEditing]=useState(false);
  const [publishing,setPublishing]=useState(false);
  const [enableRender,setEnableRender]=useState(false);
  const [showPackage,setShowPackage]=useState(false);
  const [generated,setGenerated]=useState('');
  const [analyzed,setAnalyzed]=useState(false);
  const [message,setMessage]=useState('Görsel ekleyin; bilgiler orijinal fotoğraflardan çıkarılacaktır.');
  const cover=enableRender&&generated?generated:photos[0]||'';
  const missing=useMemo(()=>fields.filter(([k])=>{
    const value=draft[k].trim();
    if(!value)return true;
    if(!(numericKeys as readonly string[]).includes(k))return false;
    const n=parseNum(value);
    return !Number.isFinite(n)||n<0||(k==='price'&&n<=0)||
      (k!=='price'&&!Number.isSafeInteger(n))||
      (k!=='stock'&&k!=='price'&&n<1)||(k==='leadDays'&&n>14);
  }),[draft]);
  async function analyze(images:string[]){
    setAnalyzing(true);setMessage('Ürün görselleri analiz ediliyor…');
    try{
      const result=await adminPost<AIProduct>('/api/business/ai-products/analyze',{
        images,hints:{name:'',sku:'',barcode:'',brand:'',category:'',notes:''}
      });
      setDraft(previous=>{
        const next={...previous};
        for(const [key] of fields){
          if((numericKeys as readonly string[]).includes(key))continue;
          if(previous[key].trim())continue;
          const value=result.product?.[key];
          if(typeof value==='string'&&value.trim())next[key]=value.trim();
        }
        return next;
      });
      setAnalyzed(true);
      setMessage('AI bilgileri doldurdu. Eksikleri tamamlayın, görseli ve ürün kartını onaylayın.');
    }catch(err){setMessage(err instanceof Error?err.message:'Analiz yapılamadı. Yeniden deneyin.');}
    finally{setAnalyzing(false);}
  }
  async function pick(){
    if(photos.length>=4||publishing||analyzing)return;
    try{
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted){Alert.alert('Galeri izni','Görsel seçmek için galeri izni gerekiyor.');return;}
      const picked=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:['images'],allowsMultipleSelection:true,selectionLimit:4-photos.length,base64:true,quality:0.5,
      });
      if(picked.canceled)return;
      const added=picked.assets.filter(x=>!!x.base64).map(x=>
        'data:'+(x.mimeType==='image/png'?'image/png':x.mimeType==='image/webp'?'image/webp':'image/jpeg')+
        ';base64,'+x.base64).filter(x=>x.length<=3500000);
      const next=[...photos,...added].slice(0,4);
      if(next.length===photos.length)return;
      if(next.reduce((total,x)=>total+x.length,0)>12000000){
        Alert.alert('Dosya boyutu','Toplam görsel boyutu sınırı aşıldı.');return;
      }
      setPhotos(next);setGenerated('');setAnalyzed(false);
      // A fresh selection is analyzed immediately; never send generated imagery for OCR.
      void analyze(next);
    }catch(e){setMessage(e instanceof Error?e.message:'Görsel seçimi başarısız.');}
  }
  async function render(){
    if(!photos.length||editing||analyzing)return;
    if(showPackage&&photos.length<2){
      Alert.alert('Ambalaj eksik','İkinci görsel olarak ürünün gerçek ambalaj fotoğrafını ekleyin.');return;
    }
    setEditing(true);setMessage('Saf beyaz arka planlı ürün görseli oluşturuluyor…');
    try{
      const result=await adminPost<RenderResult>('/api/business/ai-products/render',{
        images:photos,includePackaging:showPackage
      });
      if(!result.image.startsWith('data:image/'))throw Error('Görsel formatı geçersiz.');
      setGenerated(result.image);
      setMessage('Yeni görsel hazır. Ürünü yayına göndermeden önce kontrol edin.');
    }catch(e){setMessage(e instanceof Error?e.message:'Görsel üretilemedi, orijinali kullanabilirsiniz.');}
    finally{setEditing(false);}
  }
  async function save(){
    if(publishing||editing||analyzing)return;
    if(!allowed){Alert.alert('Yetki gerekli','Ürün ekleme yalnızca yetkili yönetici ve tedarikçiler içindir.');return;}
    if(!analyzed){setMessage('Önce görselleri analiz edin.');return;}
    if(missing.length){setMessage('Eksik/hatalı alanlar: '+missing.map(x=>x[1]).join(', '));return;}
    setPublishing(true);
    try{
      const images=enableRender&&generated?[generated,...photos.slice(0,3)]:photos;
      const item={
        ...draft,image:images[0],images,
        tags:draft.tags.split(',').map(x=>x.trim()).filter(Boolean),
        price:parseNum(draft.price),stock:parseNum(draft.stock),unitsPerBox:parseNum(draft.unitsPerBox),
        minOrderQty:parseNum(draft.minOrderQty),leadDays:parseNum(draft.leadDays),
      };
      const saved=await adminPost<SaveResult>('/api/business/ai-products/submit',item);
      Alert.alert(saved.isLive?'Ürün yayında':'Yönetici onayı bekleniyor',saved.message,
        [{text:'Tamam',onPress:()=>router.back()}]);
    }catch(e){setMessage(e instanceof Error?e.message:'Ürün kaydedilemedi.');}
    finally{setPublishing(false);}
  }
  if(!allowed)return <View style={s.page}><Text style={s.title}>Yetkiniz bulunmuyor</Text>
    <Text style={s.hint}>Yapay zekâ ile ürün ekleme, onaylı tedarikçiler ve süper yöneticilere açıktır.</Text>
    <Pressable onPress={()=>router.back()} style={s.button}><Text style={s.buttonText}>Geri dön</Text></Pressable></View>;
  return <ScrollView style={s.page} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <Pressable onPress={()=>router.back()}><Text style={s.back}>‹  Ürünlere dön</Text></Pressable>
    <Text style={s.title}>AI ile Ürün Ekle</Text>
    <Text style={s.hint}>Çalışkan B2B · Görsel analizi, beyaz fon ve yönetici onayı</Text>
    <Pressable onPress={()=>void pick()} style={s.upload} disabled={analyzing||publishing}>
      {cover?<Image source={{uri:cover}} resizeMode="contain" style={s.image}/>:
        <Text style={s.uploadText}>+ Ürün fotoğrafı ekle</Text>}
    </Pressable>
    <Text style={s.hint}>{photos.length}/4 fotoğraf · Ürün fotoğrafı ilk, ambalaj fotoğrafı ikinci sırada</Text>
    <Pressable onPress={()=>void pick()} style={s.outline} disabled={photos.length>=4}>
      <Text style={s.outlineText}>+ Başka fotoğraf ekle</Text>
    </Pressable>
    {photos.length>0?<Pressable onPress={()=>{setPhotos([]);setGenerated('');setAnalyzed(false);setDraft(makeDraft());}} style={s.outline}>
      <Text style={s.outlineText}>Fotoğrafları temizle</Text>
    </Pressable>:null}
    <View style={s.card}>
      <Text style={s.section}>İsteğe bağlı görsel düzenleme</Text>
      <View style={s.toggle}><Text style={s.toggleLabel}>Saf beyaz fon + 3D açı</Text>
        <Switch value={enableRender} onValueChange={v=>{setEnableRender(v);setGenerated('');}}/></View>
      {enableRender?<><View style={s.toggle}><Text style={s.toggleLabel}>Gerçek ambalajı yanında göster</Text>
        <Switch value={showPackage} onValueChange={v=>{setShowPackage(v);setGenerated('');}}/></View>
        <Pressable onPress={()=>void render()} style={s.button} disabled={!photos.length||analyzing||editing}>
          {editing?<ActivityIndicator color="#111"/>:<Text style={s.buttonText}>AI ile görseli düzenle</Text>}
        </Pressable>
        {generated?<Pressable onPress={()=>setGenerated('')} style={s.outline}>
          <Text style={s.outlineText}>Orijinal görsele geri dön</Text></Pressable>:null}
      </>:null}
    </View>
    <View style={s.card}><Text style={s.section}>Ürün bilgileri · {fields.length-missing.length}/{fields.length} tamamlandı</Text>
      <Text style={s.hint}>{message}</Text>
      {photos.length>0?<Pressable onPress={()=>void analyze(photos)} style={s.outline} disabled={analyzing||publishing}>
        {analyzing?<ActivityIndicator color="#111"/>:<Text style={s.outlineText}>AI analizini yeniden çalıştır</Text>}
      </Pressable>:null}
      {fields.map(([key,label])=><View key={key} style={s.field}>
        <Text style={s.label}>{label} {draft[key].trim()?'✓':'*'}</Text>
        <TextInput value={draft[key]} onChangeText={value=>setDraft(v=>({...v,[key]:value}))}
          keyboardType={(numericKeys as readonly string[]).includes(key)?'decimal-pad':'default'}
          multiline={key==='description'} style={[s.input,key==='description'&&s.multiline]}
          placeholder={label} placeholderTextColor="#88919F"/>
      </View>)}
    </View>
    <View style={s.card}>
      <Text style={s.section}>Son kontrol ve onay</Text>
      <Text style={s.hint}>{user.role==='super_admin'?'Onayladığınız ürün doğrudan yayına alınır.':'Ürün yönetici onayına gönderilir; onaylanana kadar yayında olmaz.'}</Text>
      {cover?<Image source={{uri:cover}} resizeMode="contain" style={s.preview}/>:null}
      <Pressable onPress={()=>void save()} style={[s.button,(publishing||missing.length>0)&&s.disabled]}
        disabled={publishing||analyzing||editing||!photos.length}>
        {publishing?<ActivityIndicator color="#111"/>:<Text style={s.buttonText}>✓  {user.role==='super_admin'?'Onayla ve yayınla':'Onaya gönder'}</Text>}
      </Pressable>
    </View>
  </ScrollView>;
}
const s=StyleSheet.create({
  page:{flex:1,backgroundColor:'#F8FAFC'},content:{padding:20,paddingTop:50,paddingBottom:90},
  back:{color:'#475569',marginBottom:16,fontWeight:'700',fontSize:14},
  title:{fontSize:26,fontWeight:'900',color:'#0F172A'},hint:{fontSize:12,color:'#64748B',lineHeight:20,marginTop:7,marginBottom:10},
  upload:{borderWidth:1,borderStyle:'dashed',borderColor:'#94A3B8',minHeight:210,borderRadius:20,alignItems:'center',justifyContent:'center',marginTop:18,backgroundColor:'#FFF',overflow:'hidden'},
  image:{width:'100%',height:220},uploadText:{fontWeight:'800',fontSize:15,color:'#0F172A'},
  card:{backgroundColor:'#FFF',padding:16,borderRadius:20,marginTop:16,borderWidth:1,borderColor:'#E2E8F0'},
  section:{fontSize:17,fontWeight:'900',color:'#0F172A',marginBottom:10},
  toggle:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:8},
  toggleLabel:{fontSize:13,fontWeight:'700',color:'#334155',flex:1},
  button:{backgroundColor:'#FFCD00',borderRadius:13,padding:15,marginTop:12,alignItems:'center'},
  buttonText:{fontSize:14,fontWeight:'900',color:'#0F172A'},disabled:{opacity:0.5},
  outline:{borderWidth:1,borderColor:'#CBD5E1',padding:12,borderRadius:12,alignItems:'center',marginTop:12},
  outlineText:{color:'#334155',fontSize:13,fontWeight:'800'},
  field:{marginTop:11},label:{fontSize:12,fontWeight:'700',color:'#334155',marginBottom:6},
  input:{borderWidth:1,borderColor:'#CBD5E1',backgroundColor:'#F8FAFC',borderRadius:12,padding:12,fontSize:14,color:'#0F172A',minHeight:46},
  multiline:{minHeight:90,textAlignVertical:'top'},preview:{height:210,width:'100%',backgroundColor:'#FFF'},
});
