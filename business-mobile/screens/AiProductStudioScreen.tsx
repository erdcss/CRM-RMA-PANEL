import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Image, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { apiFetch } from "../lib/api";
import { C } from "../ui/theme";

type ProductKey =
  | "sku" | "name" | "barcode" | "brand" | "category" | "description"
  | "model" | "color" | "material" | "size" | "collectionName" | "tags"
  | "price" | "stock" | "unitsPerBox" | "minOrderQty" | "leadDays";
type Draft = Record<ProductKey, string>;
type AiResult = { product: Record<string, string>; cached?: boolean; elapsedMs?: number };
type SubmitResult = { productId: string | number; status: string; isLive: boolean; message: string };
type Phase = "image" | "editing" | "preview";
type FieldDefinition = {key:ProductKey;label:string;hint?:string;numeric?:boolean;multiline?:boolean};
const required: FieldDefinition[] = [
  {key:"name",label:"Ürün adı",hint:"Ürünün tam, ayırt edici adı"},
  {key:"sku",label:"Stok kodu (SKU)",hint:"Örnek: CL-2026-001"},
  {key:"barcode",label:"Barkod",hint:"EAN/UPC veya geçerli üretici barkodu",numeric:true},
  {key:"brand",label:"Marka",hint:"Ürün üzerindeki marka"},
  {key:"model",label:"Model",hint:"Model / seri bilgisi"},
  {key:"category",label:"Kategori",hint:"Ürünün ait olduğu kategori"},
  {key:"collectionName",label:"Koleksiyon",hint:"Mağaza koleksiyon adı"},
  {key:"color",label:"Renk"},
  {key:"material",label:"Malzeme"},
  {key:"size",label:"Ölçü / ebat"},
  {key:"tags",label:"Ürün etiketleri",hint:"Virgülle ayırın: elektrikli, mutfak"},
  {key:"description",label:"Ürün açıklaması",multiline:true},
  {key:"price",label:"Satış fiyatı (TL)",numeric:true},
  {key:"stock",label:"Stok adedi",numeric:true},
  {key:"unitsPerBox",label:"Koli içi adet",numeric:true},
  {key:"minOrderQty",label:"Minimum sipariş (koli)",numeric:true},
  {key:"leadDays",label:"Hazırlık / termin (gün)",numeric:true},
];
const emptyDraft = ():Draft => Object.fromEntries(required.map(field=>[field.key,""])) as Draft;
const parseNumber = (value:string) => Number(value.trim().replace(",","."));
// Picker MIME labels can be inaccurate on iOS, especially for HEIC photos.
// Use actual encoded image bytes so AI never receives mislabeled input.
function imageMimeFromBase64(value:string):"image/jpeg"|"image/png"|"image/webp"|null {
  if(value.startsWith("/9j/"))return "image/jpeg";
  if(value.startsWith("iVBORw0KGgo"))return "image/png";
  if(value.startsWith("UklGR"))return "image/webp";
  return null;
}
function validate(form:Draft):ProductKey[] {
  return required.filter(field=>{
    const value=form[field.key]?.trim();
    if(!value)return true;
    if(field.numeric){
      const number=parseNumber(value);
      if(!Number.isFinite(number))return true;
      if(field.key==="price")return number<=0;
      if(!Number.isSafeInteger(number))return true;
      if(field.key==="stock")return number<0;
      if(field.key==="leadDays")return number<1||number>14;
      return number<1;
    }
    if(field.key==="tags")return !value.split(",").some(tag=>tag.trim().length>0);
    return false;
  }).map(field=>field.key);
}
const formatValue=(key:ProductKey,val:string)=>key==="price"&&val?val+" ₺":val;
function Tile({label,value}:{label:string;value:string}){
  return <View style={styles.previewField}>
    <Text style={styles.previewLabel}>{label}</Text>
    <Text style={styles.previewValue}>{value}</Text>
  </View>;
}

export function AiProductStudioScreen({mode,onBack,onCreated}:{
  mode:"super_admin"|"supplier";onBack:()=>void;onCreated:()=>void;
}) {
  const [photos,setPhotos]=useState<string[]>([]);
  const [renderEnabled,setRenderEnabled]=useState(false);
  const [includePackaging,setIncludePackaging]=useState(false);
  const [renderedImage,setRenderedImage]=useState("");
  const [rendering,setRendering]=useState(false);
  // Generated product art is part of the real product gallery, not a detached preview.
  // Keep the rendered image first (cover), with a maximum of four saved images.
  const galleryImages = useMemo(() => [ ...(renderEnabled && renderedImage ? [renderedImage] : []), ...photos ].slice(0,4), [renderEnabled,renderedImage,photos]);
  const photo=galleryImages[0]||"";
  const [scannerOpen,setScannerOpen]=useState(false);
  const [scanLocked,setScanLocked]=useState(false);
  const [cameraPermission,requestCameraPermission]=useCameraPermissions();
  const maxPhotos=4;
  const maxImageLength=3_500_000;
  const maxGalleryLength=12_000_000;
  const [form,setForm]=useState<Draft>(emptyDraft);
  const [notes,setNotes]=useState("");
  const [phase,setPhase]=useState<Phase>("image");
  const [analyzed,setAnalyzed]=useState(false);
  const [aiFilledKeys,setAiFilledKeys]=useState<ProductKey[]>([]);
  const userEdited=useRef<Set<ProductKey>>(new Set());
  const aiValues=useRef<Partial<Record<ProductKey,string>>>({});
  const analysisRequest=useRef(0);
  const formRef=useRef<Draft>(form);
  const [analyzing,setAnalyzing]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  const [analysisInfo,setAnalysisInfo]=useState("");
  const pulse=useRef(new Animated.Value(0)).current;
  const progress=useRef(new Animated.Value(0)).current;
  const isOwner=mode==="super_admin";
  const invalid=useMemo(()=>validate(form),[form]);
  const done=required.length-invalid.length;
  const completion=Math.round(done/required.length*100);
  const fieldsToComplete=useMemo(()=>required.filter(field=>!aiFilledKeys.includes(field.key)),[aiFilledKeys]);
  const detectedFields=useMemo(()=>required.filter(field=>aiFilledKeys.includes(field.key)),[aiFilledKeys]);
  useEffect(()=>()=>{analysisRequest.current+=1;},[]);
  useEffect(()=>{
    const anim=Animated.loop(Animated.sequence([
      Animated.timing(pulse,{toValue:1,duration:1700,useNativeDriver:true}),
      Animated.timing(pulse,{toValue:0,duration:1700,useNativeDriver:true}),
    ]));
    anim.start();
    return ()=>anim.stop();
  },[pulse]);
  useEffect(()=>{
    Animated.timing(progress,{toValue:completion,duration:380,useNativeDriver:false}).start();
  },[completion,progress]);


  function change(key:ProductKey,value:string) {
    userEdited.current.add(key);
    const updated={...formRef.current,[key]:value};
    formRef.current=updated;
    setForm(updated);setError("");
    if(phase==="preview")setPhase("editing");
  }

  // Pass the freshly selected image directly; photo state is asynchronous.
  async function analyzeImages(images:string[],requestId:number){
    setAnalyzing(true);setError("");setAnalysisInfo("");
    const draft=formRef.current;
    const hint=(key:"name"|"sku"|"barcode"|"brand"|"category")=>
      userEdited.current.has(key)?draft[key].trim():"";
    try {
      const result=await apiFetch<AiResult>("/api/business/ai-products/analyze",{
        method:"POST",body:JSON.stringify({images,hints:{
          name:hint("name"),sku:hint("sku"),barcode:hint("barcode"),
          brand:hint("brand"),category:hint("category"),notes:notes.trim(),
        }})
      });
      if(requestId!==analysisRequest.current)return;
      const updated={...formRef.current};
      const recognized={...aiValues.current};
      let total=0;
      for(const field of required){
        // Barcode may be read from a clear label photo; prices and quantities
        // must still come from the user, never model guesses.
        if((field.numeric&&field.key!=="barcode")||userEdited.current.has(field.key))continue;
        const suggestion=result.product?.[field.key];
        if(typeof suggestion!=="string"||!suggestion.trim())continue;
        const oldAi=aiValues.current[field.key];
        if(updated[field.key].trim()&&updated[field.key]!==oldAi)continue;
        updated[field.key]=suggestion.trim();
        recognized[field.key]=suggestion.trim();
        total++;
      }
      aiValues.current=recognized;
      formRef.current=updated;
      setForm(updated);
      setAiFilledKeys(required.filter(field=>!!recognized[field.key]&&!userEdited.current.has(field.key)).map(field=>field.key));
      setAnalyzed(true);setPhase("editing");
      setAnalysisInfo(result.cached?"Önceki analiz anında yüklendi. Eksikleri tamamlayın.":
        total+" bilgi AI tarafından dolduruldu. Görülemeyen bilgileri siz tamamlayın.");
    }catch(e){
      if(requestId!==analysisRequest.current)return;
      setError((e instanceof Error?e.message:"Görsel analiz edilemedi.")+
        " Yeniden deneyebilir veya bilgileri manuel doldurabilirsiniz.");
      setPhase("image");
    }finally{if(requestId===analysisRequest.current)setAnalyzing(false);}
  }

  function restartForGallery(nextImages:string[],keepGenerated=false){
    // Removing or adding a photo invalidates earlier model output, but
    // manually entered fields stay intact across multiple scans.
    const cleaned={...formRef.current};
    for(const field of required){
      const oldAi=aiValues.current[field.key];
      if(oldAi&&!userEdited.current.has(field.key)&&cleaned[field.key]===oldAi)cleaned[field.key]="";
    }
    aiValues.current={};
    formRef.current=cleaned;setForm(cleaned);setAiFilledKeys([]);
    setPhotos(nextImages);setRenderedImage(keepGenerated?renderedImage:"");setAnalyzed(false);setPhase("image");setAnalysisInfo("");setError("");
    const requestId=++analysisRequest.current;
    if(nextImages.length)void analyzeImages(nextImages,requestId);
    else setAnalyzing(false);
  }

  async function pickImage(fromCamera=false){
    if(submitting||galleryImages.length>=maxPhotos)return;
    try{
      const permission=fromCamera?await ImagePicker.requestCameraPermissionsAsync():
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted){
        Alert.alert("Görsel izni gerekli",fromCamera?
          "Ürün fotoğrafı çekmek için kamera izni verin.":"Ürün görseli seçmek için galeri izni verin.");
        return;
      }
      const remaining=maxPhotos-galleryImages.length;
      const result=fromCamera?
        await ImagePicker.launchCameraAsync({mediaTypes:["images"],base64:true,quality:0.5}):
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes:["images"],allowsEditing:false,allowsMultipleSelection:true,
          selectionLimit:remaining,base64:true,quality:0.5,
          preferredAssetRepresentationMode:ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        });
      if(result.canceled||!result.assets.length)return;
      const next=[...photos];
      let unsupported=0;
      for(const asset of result.assets.slice(0,remaining)){
        if(!asset.base64){unsupported++;continue;}
        const mime=imageMimeFromBase64(asset.base64);
        if(!mime){unsupported++;continue;}
        const image="data:"+mime+";base64,"+asset.base64;
        if(image.length>maxImageLength){
          Alert.alert("Fotoğraf çok büyük","Her fotoğraf en fazla yaklaşık 2,5 MB olmalıdır.");
          continue;
        }
        if(next.includes(image))continue;
        if(next.reduce((n,x)=>n+x.length,0)+image.length>maxGalleryLength){
          Alert.alert("Görsel sınırı","Toplam fotoğraf boyutu fazla. Daha küçük görseller seçin.");
          break;
        }
        next.push(image);
      }
      if(next.length>photos.length)restartForGallery(next,Boolean(renderedImage));
      if(unsupported>0){
        setError(unsupported+" fotoğraf HEIC/HEIF veya desteklenmeyen biçimde geldi. Galeriden JPG/PNG sürümünü seçin ya da fotoğrafı JPG olarak paylaşın.");
      }
    }catch(e){setError(e instanceof Error?e.message:"Fotoğraf seçilemedi.");}
  }

  async function openBarcodeScanner(){
    try {
      let permission=cameraPermission;
      if(!permission?.granted)permission=await requestCameraPermission();
      if(!permission?.granted){Alert.alert("Kamera izni gerekli","Barkodu taramak için kamera izni verin.");return;}
      setScanLocked(false);setScannerOpen(true);
    }catch(e){setError(e instanceof Error?e.message:"Kamera açılamadı.");}
  }

  function handleBarcodeScan(value:string){
    if(scanLocked||!value.trim())return;
    setScanLocked(true);
    change("barcode",value.trim());
    setScannerOpen(false);
  }

  function removeGalleryImage(index:number){
    if(submitting||rendering)return;
    if(renderEnabled&&renderedImage){
      if(index===0){setRenderedImage("");return;}
      removePhoto(index-1);
    }else removePhoto(index);
  }

  function removePhoto(index:number){
    if(submitting)return;
    restartForGallery(photos.filter((_,i)=>i!==index),Boolean(renderedImage));
  }

  function retryAnalysis(){
    if(!photos.length||analyzing||submitting)return;
    setPhase("image");
    void analyzeImages(photos,++analysisRequest.current);
  }

  async function renderProductPhoto(){
    if(!photos.length||rendering||submitting)return;
    if(photos.length>=maxPhotos&&!renderedImage){
      setError('Oluşturulan AI görselini galeriye eklemek için önce kaynak fotoğraflardan birini silin (en fazla 4 görsel).');return;
    }
    if(includePackaging&&photos.length<2){
      setError("Ambalaj seçildi. İkinci fotoğraf olarak gerçek ürün ambalajını yükleyin.");return;
    }
    setRendering(true);setError("");
    try{
      const result=await apiFetch<{image:string}>("/api/business/ai-products/render",{
        method:"POST",body:JSON.stringify({images:photos,includePackaging}),
      });
      if(!result.image.startsWith("data:image/"))throw Error("Görsel alınamadı.");
      setRenderedImage(result.image);
      setAnalysisInfo("Beyaz fon görseli hazır. Ürün bilgileri yalnızca orijinal fotoğraflardan okunur.");
    }catch(e){setError(e instanceof Error?e.message:"Görsel oluşturulamadı.");}
    finally{setRendering(false);}
  }

  function useManualEntry(){
    if(!photo||analyzing)return;
    setAnalyzed(true);setAiFilledKeys([]);setPhase("editing");setError("");
    setAnalysisInfo("Manuel giriş açık. Önizleme için tüm zorunlu bilgileri doldurun.");
  }

  function renderField(field:FieldDefinition,detected:boolean){
    const missing=invalid.includes(field.key);
    return <View key={field.key} style={styles.inputGroup}>
      <View style={styles.fieldHeading}>
        <Text style={styles.inputLabel}>{field.label} <Text style={styles.star}>*</Text></Text>
        <Text style={[styles.fieldStatus,missing?styles.fieldMissing:styles.fieldComplete]}>
          {missing?"Gerekli":detected&&!userEdited.current.has(field.key)?"AI doldurdu":"Tamamlandı"}
        </Text>
      </View>
      <TextInput
        style={[styles.input,field.multiline&&styles.multi,missing&&styles.pendingInput]}
        value={form[field.key]} onChangeText={value=>change(field.key,value)}
        placeholder={field.hint||field.label+" girin"} placeholderTextColor={C.muted}
        keyboardType={field.numeric?(field.key==="price"?"decimal-pad":"number-pad"):"default"}
        multiline={field.multiline} textAlignVertical={field.multiline?"top":"center"}
        autoCorrect={field.key==="description"||field.key==="name"}
      />
    </View>;
  }

  function review(){
    if(!analyzed){setError("Önizleme için önce fotoğrafı AI ile analiz edin.");setPhase("image");return;}
    if(invalid.length){
      setError("Eksik veya hatalı alanlar: "+required.filter(field=>invalid.includes(field.key)).map(field=>field.label).join(", "));
      setPhase("editing");return;
    }
    setError("");setPhase("preview");
  }
  async function submit(){
    if(submitting||analyzing||rendering)return;
    if(!galleryImages.length||!analyzed||invalid.length){review();return;}
    setSubmitting(true);setError("");
    try{
      const data={
        ...form,
        name:form.name.trim(),sku:form.sku.trim(),barcode:form.barcode.trim(),
        brand:form.brand.trim(),category:form.category.trim(),
        model:form.model.trim(),color:form.color.trim(),material:form.material.trim(),
        size:form.size.trim(),description:form.description.trim(),
        collectionName:form.collectionName.trim(),
        tags:form.tags.split(",").map(tag=>tag.trim()).filter(Boolean),
        price:parseNumber(form.price),stock:parseNumber(form.stock),
        unitsPerBox:parseNumber(form.unitsPerBox),minOrderQty:parseNumber(form.minOrderQty),
        leadDays:parseNumber(form.leadDays),image:photo,images:galleryImages,
      };
      const result=await apiFetch<SubmitResult>("/api/business/ai-products/submit",{
        method:"POST",body:JSON.stringify(data),
      });
      Alert.alert(result.isLive?"Ürün yayında":"Yönetici onayı bekleniyor",
        result.isLive?"Çalışkan B2B kataloğunda ürün satışa açıldı.":"Ürününüz yöneticinin inceleme listesine gönderildi. Onaylanınca yayına alınacak.",
        [{text:"Tamam",onPress:onCreated}]);
    }catch(e){setError(e instanceof Error?e.message:"Ürün kaydedilemedi.");setPhase("editing");}
    finally{setSubmitting(false);}
  }

  const opacity=pulse.interpolate({inputRange:[0,1],outputRange:[0.3,0.85]});
  const lift=pulse.interpolate({inputRange:[0,1],outputRange:[0,-5]});
  const barWidth=progress.interpolate({inputRange:[0,100],outputRange:["0%","100%"]});

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS==="ios"?"padding":undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={onBack}><Text style={styles.backText}>‹</Text></TouchableOpacity>
        <Text style={styles.micro}>ÇALIŞKAN BUSINESS</Text>
        <View style={styles.live}><View style={styles.liveDot}/><Text style={styles.liveText}>AI STUDIO</Text></View>
      </View>

      <View style={styles.hero}>
        <Animated.View style={[styles.halo,{opacity,transform:[{translateY:lift}]}]}/>
        <Text style={styles.eyebrow}>YENİ NESİL ÜRÜN YÖNETİMİ</Text>
        <Text style={styles.title}>AI ile ürün{"\n"}eklemek artık <Text style={styles.titleBlue}>çok hızlı.</Text></Text>
        <Text style={styles.subtitle}>Ürünün ön, arka, etiket ve barkod fotoğraflarını ekleyin. AI tüm fotoğrafları birlikte analiz eder; eksikleri sizden ister.</Text>
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>GÖRSEL ANALİZİ</Text><Text style={styles.ribbonArrow}>→</Text>
          <Text style={styles.ribbonText}>KONTROL</Text><Text style={styles.ribbonArrow}>→</Text>
          <Text style={styles.ribbonText}>YAYIN</Text>
        </View>
      </View>

      <View style={styles.status}>
        <View><Text style={styles.statusTitle}>Ürün kartı hazırlık durumu</Text><Text style={styles.statusSub}>{done}/{required.length} zorunlu alan tamamlandı</Text></View>
        <Text style={styles.percent}>{completion}%</Text>
      </View>
      <View style={styles.progressTrack}><Animated.View style={[styles.progressFill,{width:barWidth}]}/></View>

      <View style={styles.card}>
        <View style={styles.cardHeading}><Text style={styles.sectionIndex}>01</Text><View style={styles.flex}><Text style={styles.heading}>Ürün görseli</Text><Text style={styles.subheading}>En fazla 4 fotoğraf · Ön, arka, etiket ve barkod</Text></View><Text style={styles.asterisk}>*</Text></View>
        <TouchableOpacity style={styles.imageDrop} onPress={()=>void pickImage()} activeOpacity={0.83} disabled={galleryImages.length>=maxPhotos||submitting}>
          {photo?<Image source={{uri:photo}} style={styles.photo} resizeMode="contain"/>:
            <View style={styles.uploadEmpty}><Text style={styles.uploadIcon}>▧</Text><Text style={styles.uploadTitle}>Ürün fotoğrafını seç</Text><Text style={styles.uploadHint}>Net, aydınlık, ürünü önden gösteren fotoğraf</Text></View>}
          {photo?<View style={styles.replace}><Text style={styles.replaceText}>{galleryImages.length}/{maxPhotos} · Kapak fotoğrafı</Text></View>:null}
        </TouchableOpacity>
        <View style={styles.photoActions}>
          <TouchableOpacity style={[styles.photoAction,galleryImages.length>=maxPhotos&&styles.disabled]}
            disabled={galleryImages.length>=maxPhotos||submitting} onPress={()=>void pickImage(true)}>
            <Text style={styles.photoActionText}>◎  Fotoğraf çek</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.photoAction,galleryImages.length>=maxPhotos&&styles.disabled]}
            disabled={galleryImages.length>=maxPhotos||submitting} onPress={()=>void pickImage(false)}>
            <Text style={styles.photoActionText}>▧  Çoklu fotoğraf seç</Text>
          </TouchableOpacity>
        </View>
        {galleryImages.length>0?<View style={styles.galleryWrap}>
          <Text style={styles.galleryTitle}>{galleryImages.length}/{maxPhotos} ürün görseli · AI analizinde orijinal fotoğraflar kullanılır</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
            {galleryImages.map((src,index)=><View key={index} style={styles.galleryItem}>
              <Image source={{uri:src}} style={styles.galleryImage} resizeMode="cover"/>
              <Text style={styles.galleryCaption}>{renderEnabled&&renderedImage&&index===0?"AI · Kapak":index===0?"Kapak":index+1+". görsel"}</Text>
              <TouchableOpacity style={styles.galleryRemove} accessibilityLabel={(index+1)+". fotoğrafı kaldır"}
                disabled={submitting} onPress={()=>removeGalleryImage(index)}>
                <Text style={styles.galleryRemoveText}>×</Text>
              </TouchableOpacity>
            </View>)}
          </ScrollView>
          <Text style={styles.galleryHint}>Ambalajın farklı yüzlerini ve barkodu yakından çekmek doğruluğu artırır.</Text>
        </View>:null}
      </View>

      {photos.length>0?<View style={styles.card}>
        <Text style={styles.heading}>AI görsel düzenleme · İsteğe bağlı</Text>
        <TouchableOpacity style={styles.secondary} disabled={rendering||submitting} onPress={()=>{
          setRenderEnabled(!renderEnabled);setRenderedImage("");
        }}><Text style={styles.secondaryText}>{renderEnabled?"☑  Beyaz fon açık":"☐  Beyaz fonu düzenle"}</Text></TouchableOpacity>
        {renderEnabled?<>
          <TouchableOpacity style={styles.secondary} disabled={rendering||submitting}
            onPress={()=>{setIncludePackaging(!includePackaging);setRenderedImage("");}}>
            <Text style={styles.secondaryText}>{includePackaging?"☑  Ambalajı yanında göster":"☐  Ambalajı yanında göster"}</Text>
          </TouchableOpacity>
          <Text style={styles.helper}>Saf beyaz fon, hafif 3D açı. Ambalaj seçilirse ikinci görsel gerçek ürün ambalajına ait olmalıdır.</Text>
          <TouchableOpacity style={[styles.primary,(rendering||analyzing||submitting)&&styles.disabled]}
            disabled={rendering||analyzing||submitting} onPress={()=>void renderProductPhoto()}>
            {rendering?<ActivityIndicator color="#081726"/>:<Text style={styles.primaryText}>✦  Görseli AI ile oluştur</Text>}
          </TouchableOpacity>
          {renderedImage?<View style={styles.previewImageBox}><Image source={{uri:renderedImage}}
            style={styles.previewImage} resizeMode="contain"/><Text style={styles.aiImageAdded}>✓ AI görseli ürün galerisinin ilk sırasına eklendi.</Text></View>:null}
          {renderedImage?<TouchableOpacity style={styles.secondary} onPress={()=>setRenderedImage("")}>
            <Text style={styles.secondaryText}>Orijinal fotoğrafı kullan</Text>
          </TouchableOpacity>:null}
        </>:null}
      </View>:null}

      {phase!=="preview"?<>
        {analyzing ? <View style={styles.analysisCard}>
          <View style={styles.analysisHeading}>
            <Animated.View style={[styles.scanPulse,{opacity}]}/>
            <View style={styles.flex}>
              <Text style={styles.analysisTitle}>AI görseli inceliyor</Text>
              <Text style={styles.analysisText}>{photos.length} fotoğraftaki ürün bilgileri birleştiriliyor.</Text>
            </View>
            <ActivityIndicator color="#90BFFF"/>
          </View>
          <Text style={styles.analysisHint}>Analiz fotoğrafı seçer seçmez otomatik başladı.</Text>
        </View> : null}
        {galleryImages.length>0&&!analyzing&&!analyzed ? <View style={styles.card}>
          <View style={styles.cardHeading}><Text style={styles.sectionIndex}>02</Text><View style={styles.flex}>
            <Text style={styles.heading}>Görsel analizi</Text>
            <Text style={styles.subheading}>Bağlantı hatası olduysa yeniden deneyin</Text>
          </View></View>
          <TouchableOpacity style={styles.primary} onPress={retryAnalysis}>
            <Text style={styles.primaryText}>✦  AI analizini yeniden dene</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={useManualEntry}>
            <Text style={styles.secondaryText}>Bilgileri kendim dolduracağım</Text>
          </TouchableOpacity>
        </View> : null}
        {analyzed&&!analyzing ? <>
          {!!analysisInfo ? <View style={styles.successInfo}>
            <Text style={styles.successTitle}>✓  Ürün bilgileri hazır</Text>
            <Text style={styles.successText}>{analysisInfo}</Text>
          </View> : null}
          <View style={styles.card}>
            <View style={styles.cardHeading}>
              <Text style={styles.sectionIndex}>02</Text><View style={styles.flex}>
                <Text style={styles.heading}>Eksik bilgileri tamamlayın</Text>
                <Text style={styles.subheading}>{fieldsToComplete.length} bilgi için kullanıcı kontrolü gerekli</Text>
              </View>
              <View style={styles.missingCount}><Text style={styles.missingCountText}>{invalid.length} eksik</Text></View>
            </View>
            <Text style={styles.helper}>AI'nin doğrulayamadığı barkod, fiyat, stok veya koli bilgilerini siz girin. Eksikler tamamlandıkça durum güncellenir.</Text>
            {fieldsToComplete.map(field=>field.key==="barcode"?<View key="barcode-entry">{renderField(field,false)}<TouchableOpacity style={styles.scanButton} onPress={()=>void openBarcodeScanner()}><Text style={styles.scanButtonText}>▥  Barkodu kamerayla tara</Text></TouchableOpacity></View>:renderField(field,false))}
            {fieldsToComplete.length===0?<Text style={styles.notice}>Görsel bilgilerini kontrol edin.</Text>:null}
          </View>
          {detectedFields.length>0 ? <View style={styles.card}>
            <View style={styles.cardHeading}>
              <Text style={styles.sectionIndex}>03</Text><View style={styles.flex}>
                <Text style={styles.heading}>AI'nin doldurduğu bilgiler</Text>
                <Text style={styles.subheading}>{detectedFields.length} alan hazır · Düzenlenebilir</Text>
              </View></View>
            <Text style={styles.helper}>AI'nin önerilerini kontrol edin, yanlış veya eksik olanı doğrudan düzenleyin.</Text>
            {detectedFields.map(field=>field.key==="barcode"?<View key="barcode-scanned">{renderField(field,true)}<TouchableOpacity style={styles.scanButton} onPress={()=>void openBarcodeScanner()}><Text style={styles.scanButtonText}>▥  Barkodu yeniden tara</Text></TouchableOpacity></View>:renderField(field,true))}
          </View> : null}
          <View style={styles.card}>
            <View style={styles.cardHeading}><Text style={styles.sectionIndex}>04</Text><View style={styles.flex}>
              <Text style={styles.heading}>Son kontrol ve önizleme</Text>
              <Text style={styles.subheading}>Tüm zorunlu bilgiler tamamlanmalı</Text>
            </View></View>
            <Text style={styles.inputLabel}>AI için ek açıklama (isteğe bağlı)</Text>
            <TextInput style={[styles.input,styles.note]} value={notes} onChangeText={setNotes}
              multiline placeholder="Ürünün farkları, modeli, ambalajı..." placeholderTextColor={C.muted}/>
            <TouchableOpacity style={styles.secondary} onPress={retryAnalysis}>
              <Text style={styles.secondaryText}>✦  Yeni bilgilerle yeniden analiz et</Text>
            </TouchableOpacity>
            <View style={styles.policy}>
              <Text style={styles.policyTitle}>{isOwner?"SÜPER YÖNETİCİ · ÇALIŞKAN ÜRÜNÜ":"TEDARİKÇİ ÜRÜNÜ · ONAY SÜRECİ"}</Text>
              <Text style={styles.policyText}>{isOwner?
                "Ürün onayınızın ardından Çalışkan B2B kataloğunda doğrudan yayımlanır.":
                "Ürün süper yöneticinin inceleme sırasına gönderilir. Onaylanmadan yayımlanmaz."}</Text>
            </View>
            <TouchableOpacity style={[styles.primary,invalid.length>0&&styles.disabled]} onPress={review}>
              <Text style={styles.primaryText}>{invalid.length>0?invalid.length+" alan eksik · Tamamlayın":"Ürünü önizle  →"}</Text>
            </TouchableOpacity>
          </View>
        </>:null}
      </>:<View style={styles.card}>
        <View style={styles.cardHeading}><Text style={styles.sectionIndex}>✓</Text><View style={styles.flex}>
          <Text style={styles.heading}>Ürün önizleme</Text><Text style={styles.subheading}>Göndermeden önce son kontrol</Text>
        </View></View>
        <View style={styles.previewImageBox}><Image source={{uri:photo}} style={styles.previewImage} resizeMode="contain"/></View>
        {galleryImages.length>1?<View style={styles.previewGallery}>
          {galleryImages.map((src,index)=><Image key={index} source={{uri:src}} style={styles.previewGalleryImage} resizeMode="cover"/>)}
        </View>:null}
        <Text style={styles.previewTitle}>{form.name}</Text>
        <Text style={styles.previewSubtitle}>{form.brand} · {form.model} · {form.category}</Text>
        <View style={styles.priceRow}><Text style={styles.price}>{formatValue("price",form.price)}</Text><Text style={styles.stock}>Stok {form.stock}</Text></View>
        <View style={styles.previewGrid}>{required.filter(f=>!["name","price"].includes(f.key)).map(field=>
          <Tile key={field.key} label={field.label} value={form[field.key]}/>)}</View>
        <View style={styles.policy}><Text style={styles.policyTitle}>{isOwner?"DOĞRUDAN YAYIN":"YÖNETİCİ ONAYI"}</Text>
          <Text style={styles.policyText}>{isOwner?"Çalışkan ürünü hemen yayına açılacak.":"Ürün taslak olarak süper yönetici onayına iletilecek."}</Text></View>
        <TouchableOpacity style={styles.secondary} disabled={submitting} onPress={()=>setPhase("editing")}><Text style={styles.secondaryText}>←  Bilgileri düzenle</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.primary,submitting&&styles.disabled]} disabled={submitting} onPress={()=>void submit()}>
          {submitting?<ActivityIndicator color="#051021"/>:<Text style={styles.primaryText}>{isOwner?"✓  Onayla ve yayına aç":"✓  Onayla ve yöneticiye gönder"}</Text>}
        </TouchableOpacity>
      </View>}
      {!!error?<View style={styles.errorBox}><Text style={styles.errorTitle}>Kontrol gerekli</Text><Text style={styles.errorText}>{error}</Text></View>:null}
      <Text style={styles.footer}>ÇALIŞKAN BUSINESS  /  INTELLIGENT PRODUCT STUDIO</Text>
    </ScrollView>
    <Modal visible={scannerOpen} animationType="slide" onRequestClose={()=>setScannerOpen(false)}>
      <View style={styles.scannerRoot}>
        <View style={styles.scannerHeader}><Text style={styles.scannerTitle}>Ürün barkodunu okut</Text><TouchableOpacity onPress={()=>setScannerOpen(false)} accessibilityLabel="Barkod tarayıcıyı kapat"><Text style={styles.scannerClose}>Kapat ✕</Text></TouchableOpacity></View>
        {scannerOpen?<CameraView style={styles.camera} facing="back" barcodeScannerSettings={{barcodeTypes:["ean13","ean8","upc_a","upc_e","code128","code39","code93","itf14","qr"]}} onBarcodeScanned={({data})=>handleBarcodeScan(data)}/>:null}
        <Text style={styles.scannerHelp}>Barkodu kameranın ortasına hizalayın. Okununca ürün kartına otomatik eklenir.</Text>
      </View>
    </Modal>
  </KeyboardAvoidingView>;
}

const styles=StyleSheet.create({
  scannerRoot:{flex:1,backgroundColor:"#070F19",paddingTop:52,paddingHorizontal:16,paddingBottom:32},
  scannerHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:20},
  scannerTitle:{color:"#FFFFFF",fontSize:20,fontWeight:"900"},scannerClose:{color:"#98C7FF",fontSize:15,fontWeight:"800"},
  camera:{flex:1,borderRadius:18,overflow:"hidden"},scannerHelp:{color:"#C6D9F3",fontSize:12,textAlign:"center",marginTop:20,lineHeight:20},
  scanButton:{backgroundColor:"#132B47",borderRadius:12,padding:13,alignItems:"center",marginBottom:15,borderWidth:1,borderColor:"#3566A4"},
  scanButtonText:{color:"#B6D9FF",fontWeight:"800",fontSize:12},
  aiImageAdded:{position:"absolute",bottom:5,left:10,right:10,color:"#143C2F",backgroundColor:"#D1FAE5",textAlign:"center",fontWeight:"700",padding:5,borderRadius:8,fontSize:11},
  galleryWrap:{marginTop:13},
  galleryTitle:{fontSize:12,color:"#C7DCFB",fontWeight:"800",marginBottom:10},
  galleryRow:{gap:10,paddingRight:5},
  galleryItem:{width:95,position:"relative"},
  galleryImage:{width:95,height:91,borderRadius:13,backgroundColor:"#121B26",borderWidth:1,borderColor:"#294363"},
  galleryCaption:{fontSize:10,color:"#A8C1E6",marginTop:5,textAlign:"center"},
  galleryRemove:{position:"absolute",top:4,right:4,width:26,height:26,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(17,24,39,.95)",borderWidth:1,borderColor:"#67778C"},
  galleryRemoveText:{color:"#FFFFFF",fontSize:20,lineHeight:22,fontWeight:"900"},
  galleryHint:{fontSize:10,color:"#95A8C5",marginTop:10,lineHeight:16},
  previewGallery:{flexDirection:"row",gap:8,flexWrap:"wrap",marginBottom:14},
  previewGalleryImage:{width:64,height:64,borderRadius:12,borderWidth:1,borderColor:"#344966"},
  fieldHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:7,gap:6},
  fieldStatus:{fontSize:10,fontWeight:"800",textAlign:"right"},
  fieldMissing:{color:"#FFAD79"},fieldComplete:{color:"#72D9B2"},
  analysisCard:{backgroundColor:"#0E2137",borderWidth:1,borderColor:"#3566A4",borderRadius:22,padding:18,marginBottom:16},
  analysisHeading:{flexDirection:"row",alignItems:"center",gap:12},
  scanPulse:{width:16,height:16,borderRadius:8,backgroundColor:"#76B5FF"},
  analysisTitle:{color:"#EAF3FF",fontSize:16,fontWeight:"900"},
  analysisText:{color:"#B0C5E0",fontSize:11,lineHeight:17,marginTop:5},
  analysisHint:{color:"#8DAACE",fontSize:10,marginTop:12},
  successInfo:{borderRadius:18,padding:14,backgroundColor:"#10302A",borderColor:"#1D6856",borderWidth:1,marginBottom:13},
  successTitle:{color:"#85E6C1",fontSize:13,fontWeight:"900"},
  successText:{color:"#BCDCD2",fontSize:11,lineHeight:17,marginTop:5},
  missingCount:{paddingVertical:5,paddingHorizontal:9,backgroundColor:"#37251C",borderRadius:12},
  missingCountText:{color:"#FFB58B",fontSize:10,fontWeight:"900"},
  root:{flex:1,backgroundColor:C.bg},content:{paddingHorizontal:18,paddingTop:12,paddingBottom:48},
  flex:{flex:1}, top:{flexDirection:"row",alignItems:"center",gap:10,marginBottom:14},
  back:{width:39,height:39,borderRadius:14,borderWidth:1,borderColor:C.line,alignItems:"center",justifyContent:"center",backgroundColor:C.panel},
  backText:{color:C.text,fontSize:30,lineHeight:34}, micro:{flex:1,color:C.text2,fontSize:11,fontWeight:"900",letterSpacing:1.7},
  live:{borderRadius:20,backgroundColor:C.blueSoft,borderWidth:1,borderColor:"rgba(59,130,246,0.35)",paddingHorizontal:12,paddingVertical:8,flexDirection:"row",alignItems:"center",gap:6},
  liveDot:{width:6,height:6,borderRadius:3,backgroundColor:C.blue},liveText:{fontSize:9,color:"#92B9FF",fontWeight:"900",letterSpacing:1.3},
  hero:{minHeight:245,overflow:"hidden",borderRadius:28,backgroundColor:"#101E30",padding:24,borderWidth:1,borderColor:"#2E4D73",marginBottom:18},
  halo:{width:175,height:175,borderRadius:88,position:"absolute",right:-46,top:-64,backgroundColor:"#306FE6"},
  eyebrow:{color:"#92B9FF",fontSize:10,fontWeight:"900",letterSpacing:1.6,marginBottom:13},
  title:{color:"#FFFFFF",fontSize:30,fontWeight:"900",lineHeight:37,letterSpacing:-0.8},
  titleBlue:{color:"#73ADFF"},subtitle:{color:"#ACBDCF",fontSize:12,lineHeight:19,marginTop:13,maxWidth:300},
  ribbon:{marginTop:18,flexDirection:"row",alignItems:"center",gap:8,flexWrap:"wrap"},
  ribbonText:{fontSize:9,color:"#DDE9F9",fontWeight:"900",letterSpacing:0.6},
  ribbonArrow:{color:"#6097EF",fontSize:15},
  status:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:10},
  statusTitle:{color:C.text,fontSize:13,fontWeight:"800"},statusSub:{color:C.muted,fontSize:10,marginTop:3},
  percent:{color:"#84B4FF",fontSize:22,fontWeight:"900"},
  progressTrack:{height:7,borderRadius:10,overflow:"hidden",backgroundColor:C.panel2,marginBottom:19},
  progressFill:{height:7,backgroundColor:C.blue,borderRadius:10},
  card:{padding:17,borderRadius:24,borderColor:C.line,borderWidth:1,backgroundColor:C.panel,marginBottom:15,gap:4},
  cardHeading:{flexDirection:"row",gap:10,alignItems:"center",marginBottom:12},
  sectionIndex:{width:40,height:40,textAlign:"center",textAlignVertical:"center",overflow:"hidden",borderRadius:13,backgroundColor:C.blueSoft,color:"#9AC3FF",fontSize:15,fontWeight:"900"},
  heading:{color:C.text,fontSize:16,fontWeight:"900"},subheading:{color:C.muted,fontSize:10,marginTop:4,lineHeight:16},
  asterisk:{color:C.red,fontSize:20},star:{color:"#89B9FF"},
  imageDrop:{borderStyle:"dashed",borderWidth:1.5,borderColor:"#3D6390",borderRadius:20,minHeight:210,overflow:"hidden",backgroundColor:"#0A121D",alignItems:"center",justifyContent:"center"},
  uploadEmpty:{alignItems:"center",padding:20},uploadIcon:{color:"#90BDFF",fontSize:45,fontWeight:"300"},
  uploadTitle:{color:C.text,fontSize:15,fontWeight:"800",marginTop:8},
  uploadHint:{color:C.muted,fontSize:11,textAlign:"center",marginTop:8,lineHeight:17},
  photoActions:{flexDirection:"row",gap:9,marginTop:12},
  photoAction:{flex:1,borderRadius:13,borderWidth:1,borderColor:C.line,paddingVertical:12,alignItems:"center",backgroundColor:C.panel2},
  photoActionText:{color:"#BBD5FF",fontSize:11,fontWeight:"800"},
  photo:{width:"100%",height:220},replace:{position:"absolute",bottom:12,alignSelf:"center",backgroundColor:"rgba(5,12,23,.88)",paddingHorizontal:14,paddingVertical:9,borderRadius:20},
  replaceText:{color:"#D5E8FF",fontWeight:"800",fontSize:11},
  inputGroup:{marginBottom:11},inputLabel:{color:C.text2,fontSize:11,fontWeight:"700",marginBottom:7},
  input:{minHeight:49,backgroundColor:C.panel2,borderWidth:1,borderColor:C.line,borderRadius:14,paddingHorizontal:14,color:C.text,fontSize:13},
  pendingInput:{borderColor:"#334155"},note:{minHeight:80,paddingTop:13,textAlignVertical:"top"},
  multi:{minHeight:120,paddingTop:14},helper:{color:C.muted,fontSize:11,lineHeight:18,marginBottom:12},
  primary:{minHeight:56,borderRadius:17,backgroundColor:"#8CB9FF",alignItems:"center",justifyContent:"center",marginTop:14,paddingHorizontal:10},
  primaryText:{color:"#081726",fontWeight:"900",fontSize:14,textAlign:"center"},disabled:{opacity:0.55},
  busyRow:{flexDirection:"row",alignItems:"center",gap:7,marginTop:12,justifyContent:"center"},
  busyDot:{width:7,height:7,borderRadius:5,backgroundColor:C.blue},busyText:{color:C.text2,fontSize:11},
  notice:{color:C.green,fontSize:11,lineHeight:17,marginTop:12},
  policy:{borderRadius:16,borderWidth:1,borderColor:"#33547A",backgroundColor:"#0F2034",padding:14,marginTop:11},
  policyTitle:{color:"#99C3FF",fontSize:10,fontWeight:"900",letterSpacing:0.9},
  policyText:{color:"#D0DEEF",lineHeight:18,fontSize:12,marginTop:7},
  previewImageBox:{height:255,backgroundColor:"#E4EBF4",borderRadius:20,overflow:"hidden",marginBottom:12},
  previewImage:{width:"100%",height:"100%"},previewTitle:{color:C.text,fontSize:21,fontWeight:"900"},
  previewSubtitle:{color:C.text2,fontSize:12,marginTop:3},
  priceRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:12},
  price:{color:"#93C5FD",fontSize:23,fontWeight:"900"},stock:{color:C.green,fontSize:12,fontWeight:"900"},
  previewGrid:{flexDirection:"row",flexWrap:"wrap",gap:9},
  previewField:{width:"48%",padding:11,backgroundColor:C.panel2,borderRadius:13,minHeight:63},
  previewLabel:{color:C.muted,fontSize:10},previewValue:{color:C.text,fontSize:12,fontWeight:"700",marginTop:6},
  secondary:{alignItems:"center",justifyContent:"center",minHeight:48,marginTop:13,borderRadius:15,borderWidth:1,borderColor:C.line},
  secondaryText:{color:C.text2,fontSize:12,fontWeight:"800"},
  errorBox:{borderRadius:17,borderWidth:1,borderColor:"rgba(251,113,133,.45)",backgroundColor:C.redSoft,padding:15,marginBottom:15},
  errorTitle:{color:C.red,fontWeight:"900",fontSize:13},errorText:{color:"#FFD5DE",fontSize:12,lineHeight:18,marginTop:5},
  footer:{color:C.muted,fontSize:9,textAlign:"center",marginTop:6,letterSpacing:1.2}
});
