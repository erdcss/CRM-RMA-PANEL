import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Image, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
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
  const [photo,setPhoto]=useState("");
  const [form,setForm]=useState<Draft>(emptyDraft);
  const [notes,setNotes]=useState("");
  const [phase,setPhase]=useState<Phase>("image");
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
    setForm(old=>({...old,[key]:value}));
    setError("");
    if(phase==="preview")setPhase("editing");
  }

  async function pickImage() {
    if(analyzing||submitting)return;
    try{
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted){Alert.alert("Fotoğraf erişimi gerekli","Ürün fotoğrafını seçmek için galeri izni verin.");return;}
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images"],allowsEditing:false,base64:true,quality:0.54,
        selectionLimit:1,
      });
      if(result.canceled||!result.assets[0]?.base64)return;
      const asset=result.assets[0],mime=asset.mimeType==="image/png"?"image/png":asset.mimeType==="image/webp"?"image/webp":"image/jpeg";
      const image="data:"+mime+";base64,"+asset.base64;
      if(image.length>5_600_000){Alert.alert("Görsel çok büyük","4 MB altında bir ürün görseli seçin.");return;}
      setPhoto(image);setPhase("image");setAnalysisInfo("");setError("");
    }catch(e){setError(e instanceof Error?e.message:"Fotoğraf seçilemedi.");}
  }

  async function analyze() {
    if(analyzing||submitting)return;
    if(!photo){setError("Yapay zekâ için en az bir ürün görseli zorunlu.");return;}
    if(!form.name.trim()&&!form.barcode.trim()&&!form.sku.trim()){
      setError("Hızlı ve doğru analiz için ürün adı, barkod veya stok kodundan en az birini girin.");
      return;
    }
    setAnalyzing(true);setError("");setAnalysisInfo("");
    try{
      const result=await apiFetch<AiResult>("/api/business/ai-products/analyze",{
        method:"POST",body:JSON.stringify({image:photo,hints:{
          name:form.name.trim(),sku:form.sku.trim(),barcode:form.barcode.trim(),
          brand:form.brand.trim(),category:form.category.trim(),notes:notes.trim(),
        }}),
      });
      setForm(previous=>{
        const updated={...previous};
        for(const field of required){
          const suggested=result.product[field.key];
          // Never erase manually entered business data or trade parameters.
          if(field.numeric||previous[field.key].trim())continue;
          if(typeof suggested==="string"&&suggested.trim())updated[field.key]=suggested.trim();
        }
        return updated;
      });
      setPhase("editing");
      setAnalysisInfo(result.cached?"Görsel önceki analizden anında dolduruldu.":"Görsel analizi tamamlandı. Tüm alanları kontrol edin.");
    }catch(e){setError(e instanceof Error?e.message:"Yapay zekâ analiz edemedi.");}
    finally{setAnalyzing(false);}
  }
  function review(){
    if(invalid.length){
      setError("Eksik veya hatalı alanlar: "+required.filter(field=>invalid.includes(field.key)).map(field=>field.label).join(", "));
      setPhase("editing");return;
    }
    setError("");setPhase("preview");
  }
  async function submit(){
    if(submitting||analyzing)return;
    if(!photo||invalid.length){review();return;}
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
        leadDays:parseNumber(form.leadDays),image:photo,
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
        <Text style={styles.subtitle}>Fotoğrafı yükleyin, ürün bilgilerini AI hazırlasın. Eksikleri tamamlayın, önizleyin ve tek dokunuşla gönderin.</Text>
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
        <View style={styles.cardHeading}><Text style={styles.sectionIndex}>01</Text><View style={styles.flex}><Text style={styles.heading}>Ürün görseli</Text><Text style={styles.subheading}>Görsel zorunlu · JPG, PNG, WebP</Text></View><Text style={styles.asterisk}>*</Text></View>
        <TouchableOpacity style={styles.imageDrop} onPress={()=>void pickImage()} activeOpacity={0.83}>
          {photo?<Image source={{uri:photo}} style={styles.photo} resizeMode="contain"/>:
            <View style={styles.uploadEmpty}><Text style={styles.uploadIcon}>▧</Text><Text style={styles.uploadTitle}>Ürün fotoğrafını seç</Text><Text style={styles.uploadHint}>Net, aydınlık, ürünü önden gösteren fotoğraf</Text></View>}
          {photo?<View style={styles.replace}><Text style={styles.replaceText}>↻  Fotoğrafı değiştir</Text></View>:null}
        </TouchableOpacity>
      </View>

      {phase!=="preview"?<>
        <View style={styles.card}>
          <View style={styles.cardHeading}><Text style={styles.sectionIndex}>02</Text><View style={styles.flex}><Text style={styles.heading}>Yapay zekâyı yönlendir</Text><Text style={styles.subheading}>En az bir ürün adı, barkod veya SKU girin</Text></View></View>
          {required.filter(field=>["name","sku","barcode","brand","category"].includes(field.key)).map(field=>
            <View key={field.key} style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{field.label} <Text style={styles.star}>*</Text></Text>
              <TextInput style={styles.input} value={form[field.key]} onChangeText={value=>change(field.key,value)}
                placeholder={field.hint||field.label} placeholderTextColor={C.muted} autoCorrect={false}
                keyboardType={field.key==="barcode"?"number-pad":"default"}/>
            </View>
          )}
          <Text style={styles.inputLabel}>AI'ya özel açıklama</Text>
          <TextInput style={[styles.input,styles.note]} value={notes} onChangeText={setNotes}
            multiline placeholder="Ürünün modeli, kullanım şekli, farkları veya önemli ayrıntılar..." placeholderTextColor={C.muted}/>
          <TouchableOpacity style={[styles.primary,(analyzing||!photo)&&styles.disabled]} disabled={analyzing||!photo}
            onPress={()=>void analyze()} activeOpacity={0.8}>
            {analyzing?<ActivityIndicator color="#051021"/>:<Text style={styles.primaryText}>✦  Görseli AI ile analiz et</Text>}
          </TouchableOpacity>
          {analyzing?<View style={styles.busyRow}><Animated.View style={[styles.busyDot,{opacity}]}/><Text style={styles.busyText}>Görsel analiz ediliyor · hızlı model aktif</Text></View>:null}
          {!!analysisInfo?<Text style={styles.notice}>{analysisInfo}</Text>:null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeading}><Text style={styles.sectionIndex}>03</Text><View style={styles.flex}><Text style={styles.heading}>Gelişmiş ürün bilgileri</Text><Text style={styles.subheading}>Tüm bilgiler zorunlu ve düzenlenebilir</Text></View></View>
          <Text style={styles.helper}>Ürünün fotoğrafında görünmeyen ticari değerleri siz girin. AI kesin olmayan bilgileri üretmez.</Text>
          {required.filter(field=>!["name","sku","barcode","brand","category"].includes(field.key)).map(field=>
            <View key={field.key} style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{field.label} <Text style={styles.star}>*</Text></Text>
              <TextInput style={[styles.input,field.multiline&&styles.multi,!form[field.key].trim()&&styles.pendingInput]}
                value={form[field.key]} onChangeText={value=>change(field.key,value)}
                placeholder={field.hint||field.label+" girin"} placeholderTextColor={C.muted}
                keyboardType={field.numeric?(field.key==="price"?"decimal-pad":"number-pad"):"default"}
                multiline={field.multiline} textAlignVertical={field.multiline?"top":"center"}/>
            </View>
          )}
          <View style={styles.policy}>
            <Text style={styles.policyTitle}>{isOwner?"SÜPER YÖNETİCİ · ÇALIŞKAN ÜRÜNÜ":"TEDARİKÇİ ÜRÜNÜ · ONAY SÜRECİ"}</Text>
            <Text style={styles.policyText}>{isOwner?
              "Onayladığınızda Çalışkan B2B kataloğuna doğrudan yayımlanır.":
              "Siz onayladığınızda süper yöneticinin ürün inceleme sırasına gider. İnceleme tamamlanmadan yayımlanmaz."}</Text>
          </View>
          <TouchableOpacity style={[styles.primary,(completion<100||analyzing)&&styles.disabled]}
            disabled={analyzing} onPress={review}>
            <Text style={styles.primaryText}>Ürün önizlemesini aç  →</Text>
          </TouchableOpacity>
        </View>
      </>:<View style={styles.card}>
        <View style={styles.cardHeading}><Text style={styles.sectionIndex}>✓</Text><View style={styles.flex}>
          <Text style={styles.heading}>Ürün önizleme</Text><Text style={styles.subheading}>Göndermeden önce son kontrol</Text>
        </View></View>
        <View style={styles.previewImageBox}><Image source={{uri:photo}} style={styles.previewImage} resizeMode="contain"/></View>
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
  </KeyboardAvoidingView>;
}

const styles=StyleSheet.create({
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
