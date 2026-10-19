
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { apiFetch } from "../lib/api";
import { C } from "../ui/theme";
import { BackHeader } from "./common";
import { pickAndUploadSellerImage, pickAndUploadSellerVideo } from "../lib/marketplace-media";
import type { AdminOrder } from "../types";
import { money, shortDate, statusMeta } from "../ui/theme";

type Review={id:string;company_name?:string;title?:string;status:string;review_note?:string;
  contact_name?:string;created_at?:string;content?:{name?:string;title?:string}};
type Queue={suppliers:Review[];products:Review[];stores:Review[];reels:Review[]};
type AdminStats={suppliers:Array<{status:string;total:number}>;products:Array<{status:string;total:number}>;
  stores:Array<{status:string;total:number}>;reels:Array<{status:string;total:number}>;conversations:number;quotes:number};
type SupplierStats={supplier:{company_name:string;slug:string};productCount:number;followers:number;conversations:number;openQuotes:number;
  storeVersions:Array<{id:string;status:string;is_live:boolean}>;reels:Array<{id:string;title:string;video_url:string;thumbnail_url?:string|null;product_id?:number|null;status:string;is_live?:boolean}>};
type Chat={id:string;latest_message?:string;buyer_user_id:string};
type Msg={id:string;text:string;created_at:string};
type SupplierProfile={id:number;company_name:string;is_admin_paused:boolean;is_holiday:boolean;holiday_reactivate_at?:string|null};
type SellerOrder={id:number;order_id:number;created_at:string;status:string;subtotal:number|string;delivery_mode:string;items:Array<{name?:string;sku?:string;boxes?:number;total?:number|string}>};
type Tab="overview"|"suppliers"|"products"|"stores"|"reels"|"messages"|"orders"|"returns"|"payments"|"settings";
const names:Record<string,string>={overview:"Genel",suppliers:"Tedarikçiler",products:"Ürünler",stores:"Mağaza",reels:"Reels",messages:"Mesajlar",orders:"Siparişler",returns:"İadeler",payments:"Ödemeler",settings:"Ayarlar"};
const status:Record<string,string>={pending:"Onay bekliyor",approved:"Onaylandı",rejected:"Reddedildi",requested:"Teklif bekleniyor",offered:"Teklif sunuldu",accepted:"Kabul edildi"};
const Input=({value,onChangeText,placeholder,multiline=false}:{value:string;onChangeText:(x:string)=>void;placeholder:string;multiline?:boolean})=>
  <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.muted}
    multiline={multiline} style={[s.input,multiline&&{minHeight:85,textAlignVertical:"top"}]} autoCapitalize="sentences"/>;
function Action({title,onPress,disabled=false}:{title:string;onPress:()=>void;disabled?:boolean}){
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={[s.button,disabled&&{opacity:0.5}]}>
    <Text style={s.buttonText}>{title}</Text>
  </TouchableOpacity>;
}
export function MarketplaceScreen({isSuper,onBack,onLogout,onOpenOrder}:{
  isSuper:boolean;onBack:()=>void;onLogout:()=>void|Promise<void>;onOpenOrder?:(id:string)=>void}) {
 const [tab,setTab]=useState<Tab>("overview"),[overview,setOverview]=useState<AdminStats|SupplierStats|null>(null);
 const [queue,setQueue]=useState<Queue|null>(null),[products,setProducts]=useState<any[]>([]);
 const [profile,setProfile]=useState<SupplierProfile|null>(null),[supplierOrders,setSupplierOrders]=useState<SellerOrder[]>([]);
 const [adminOrders,setAdminOrders]=useState<AdminOrder[]>([]);
 const [editingProduct,setEditingProduct]=useState<string|null>(null),[editingPrice,setEditingPrice]=useState(""),[editingStock,setEditingStock]=useState("");
 const [productDraft,setProductDraft]=useState({sku:"",name:"",description:"",category:"",brand:"",barcode:"",
   imageUrl:"",unitsPerBox:"1",minBoxes:"1",leadDays:"1"});
 const [editingReel,setEditingReel]=useState<string|null>(null),[reelTitle,setReelTitle]=useState("");
 const [chats,setChats]=useState<Chat[]>([]),[selectedChat,setSelectedChat]=useState<string|null>(null),[messages,setMessages]=useState<Msg[]>([]);
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [note,setNote]=useState(""),[reply,setReply]=useState("");
 const [storeTitle,setStoreTitle]=useState(""),[storeTagline,setStoreTagline]=useState("");
 const [storeLogo,setStoreLogo]=useState<string|null>(null),[storeBanner,setStoreBanner]=useState<string|null>(null);
 const [storeAccent,setStoreAccent]=useState("#FACC15");
 const [newSku,setNewSku]=useState(""),[newName,setNewName]=useState(""),[newCategory,setNewCategory]=useState("");
 const [newPrice,setNewPrice]=useState(""),[newStock,setNewStock]=useState("0"),[newBoxes,setNewBoxes]=useState("1");
 const [newImage,setNewImage]=useState<string|null>(null),[mediaBusy,setMediaBusy]=useState(false),[mediaProgress,setMediaProgress]=useState(0);
 const [reelDraftTitle,setReelDraftTitle]=useState(""),[reelDraftVideo,setReelDraftVideo]=useState<string|null>(null),[reelDraftCover,setReelDraftCover]=useState<string|null>(null);
 const load=useCallback(async()=>{
  setError("");
  try{
   if(isSuper){
    const [a,q,orders]=await Promise.all([
      apiFetch<AdminStats>("/api/admin/marketplace/overview"),
      apiFetch<Queue>("/api/admin/marketplace/review-queue"),
      apiFetch<AdminOrder[]>("/api/admin/orders")]);
    setOverview(a);setQueue(q);setAdminOrders(orders);
   }else{
    const [a,p,c,orders,account,store]=await Promise.all([
      apiFetch<SupplierStats>("/api/marketplace/seller/dashboard"),
      apiFetch<any[]>("/api/marketplace/seller/products"),
      apiFetch<Chat[]>("/api/marketplace/conversations"),
      apiFetch<SellerOrder[]>("/api/marketplace/seller/orders"),
      apiFetch<SupplierProfile>("/api/marketplace/me"),
      apiFetch<{content:{title:string;tagline:string;accent:string;logoUrl?:string|null;bannerUrl?:string|null}}|null>("/api/marketplace/seller/store")]);
    setOverview(a);setProducts(p);setChats(c);setSupplierOrders(orders);setProfile(account);
    if(store?.content){setStoreTitle(store.content.title||"");setStoreTagline(store.content.tagline||"");
      setStoreAccent(store.content.accent||"#FACC15");
      setStoreLogo(store.content.logoUrl||null);setStoreBanner(store.content.bannerUrl||null);}
   }
  }catch(e){setError(e instanceof Error?e.message:"Veriler alınamadı");}
  finally{setLoading(false);setRefreshing(false);}
 },[isSuper]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{if(!selectedChat||isSuper)return;
    void apiFetch<Msg[]>("/api/marketplace/conversations/"+selectedChat+"/messages").then(setMessages)
      .catch(e=>setError(e instanceof Error?e.message:"Mesajlar yüklenemedi"));
 },[selectedChat,isSuper]);
 async function send(path:string,data:any){
   setWorking(true);setNotice("");setError("");
   try{
    await apiFetch(path,{method:"POST",body:JSON.stringify(data)});
    setNotice("İşlem kaydedildi.");await load();
    if(selectedChat){setMessages(await apiFetch<Msg[]>("/api/marketplace/conversations/"+selectedChat+"/messages"));}
   }catch(e){setError(e instanceof Error?e.message:"İşlem başarısız");}
   finally{setWorking(false);}
 }
 async function patch(path:string,payload:object,success:string){
  if(working)return;
  setWorking(true);setError("");setNotice("");
  try{
    await apiFetch(path,{method:"PATCH",body:JSON.stringify(payload)});
    setNotice(success);await load();
  }catch(e){setError(e instanceof Error?e.message:"İşlem başarısız");}
  finally{setWorking(false);}
 }
 function openHoliday(){
   Alert.alert("Tatil modunu aç", "1. Ürünler satıştan kaldırılır.\n2. Mağaza popülerliği düşürülür.\n3. Kapatma talebinden 24 saat sonra yeniden açılır.",[
     {text:"Vazgeç",style:"cancel"},{text:"Okudum, Onaylıyorum",onPress:()=>void patch("/api/marketplace/seller/settings",{holidayMode:true,confirmConsequences:true},"Tatil modu açıldı.")}
   ]);
 }
 function reopenHoliday(){
   Alert.alert("Tatil modunu kapat","Mağazanız 24 saat içerisinde görünür olacak. Bu süre dolana kadar ürünleriniz satışa kapalı kalacaktır.",[
     {text:"Vazgeç",style:"cancel"},{text:"Açılışı planla",onPress:()=>void patch("/api/marketplace/seller/settings",{holidayMode:false},"24 saatlik yeniden açılış planlandı.")}
   ]);
 }
 async function selectImage(onDone:(url:string)=>void){
   if(mediaBusy)return;
   setMediaBusy(true);setError("");setNotice("");
   try{const url=await pickAndUploadSellerImage();if(url){onDone(url);setNotice("Görsel yüklendi. Yayına almak için değişiklikleri onaya gönderin.");}}
   catch(e){setError(e instanceof Error?e.message:"Görsel yüklenemedi");}
   finally{setMediaBusy(false);}
 }
 async function selectVideo(){
   if(mediaBusy)return;
   setMediaBusy(true);setError("");setMediaProgress(0);
   try{
     const url=await pickAndUploadSellerVideo(setMediaProgress);
     if(url){setReelDraftVideo(url);setNotice("Video yüklendi. Onaya gönderebilirsiniz.");}
   }catch(e){setError(e instanceof Error?e.message:"Video yüklenemedi");}
   finally{setMediaBusy(false);}
 }
 async function addSupplierProduct(){
   const price=Number(newPrice),stock=Number(newStock),unitsPerBox=Number(newBoxes);
   if(!newImage||!newSku.trim()||!newName.trim()||!newCategory.trim()||
      !Number.isFinite(price)||price<=0||!Number.isSafeInteger(stock)||stock<0||
      !Number.isSafeInteger(unitsPerBox)||unitsPerBox<1){
     setError("Stok kodu, ürün adı, kategori, görsel, geçerli fiyat, koli adedi ve stok zorunludur.");return;
   }
   setWorking(true);setError("");
   try{
     await apiFetch("/api/marketplace/seller/products",{method:"POST",
       body:JSON.stringify({sku:newSku.trim(),stock,product:{
         sku:newSku.trim(),name:newName.trim(),category:newCategory.trim(),imageUrl:newImage,
         price,unitsPerBox,minBoxes:1,leadDays:1
       }})});
     setNewSku("");setNewName("");setNewCategory("");setNewPrice("");setNewStock("0");setNewBoxes("1");setNewImage(null);
     setNotice("Ürün yönetici onayına gönderildi.");await load();
   }catch(e){setError(e instanceof Error?e.message:"Ürün eklenemedi");}
   finally{setWorking(false);}
 }
 async function submitReel(){
   if(!reelDraftTitle.trim()||!reelDraftVideo){setError("Başlık ve MP4 video zorunludur.");return;}
   setWorking(true);setError("");
   try{
     await apiFetch("/api/marketplace/seller/reels",{method:"POST",body:JSON.stringify({
       title:reelDraftTitle.trim(),videoUrl:reelDraftVideo,thumbnailUrl:reelDraftCover,productId:null
     })});
     setReelDraftTitle("");setReelDraftVideo(null);setReelDraftCover(null);
     setNotice("Reels yönetici onayına gönderildi.");await load();
   }catch(e){setError(e instanceof Error?e.message:"Reels gönderilemedi");}
   finally{setWorking(false);}
 }
 const stats=overview as AdminStats|null;
 const seller=overview as SupplierStats|null;
 const items=isSuper?(tab==="suppliers"?queue?.suppliers:tab==="products"?queue?.products:tab==="stores"?queue?.stores:tab==="reels"?queue?.reels:[])||[]:[];
 const shownTabs:Tab[]=isSuper?["overview","orders","suppliers","products","stores","reels"]:["overview","orders","returns","payments","stores","products","reels","messages","settings"];
 return <ScrollView style={s.screen} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing}
    onRefresh={()=>{setRefreshing(true);void load();}} tintColor={C.text}/>}>
  <BackHeader title="Pazaryeri Yönetimi" subtitle={isSuper?"Süper yönetim merkezi":"Tedarikçi çalışma alanı"} onBack={isSuper?onBack:()=>void onLogout()}/>
  <View style={s.tabs}>{shownTabs.map(t=><TouchableOpacity key={t} onPress={()=>setTab(t)} style={[s.tab,tab===t&&s.tabActive]}>
      <Text style={[s.tabText,tab===t&&s.tabActiveText]}>{names[t]}</Text></TouchableOpacity>)}</View>
  {!isSuper&&profile?.is_admin_paused?<View style={[s.panel,{borderColor:C.red,marginBottom:12}]}>
    <Text style={[s.heading,{color:C.red}]}>Mağazanız pasife alındı</Text>
    <Text style={s.help}>Mağaza ve ürünleriniz satışa kapatıldı. Onaylı kayıtlarınız korunuyor.</Text>
    <Action title="Tekrardan Satışa Aç" disabled={working} onPress={()=>void patch("/api/marketplace/seller/pause",{paused:false},"Mağaza yeniden aktif edildi.")}/>
  </View>:null}
  {!isSuper&&profile?.is_holiday?<View style={[s.panel,{borderColor:"#CA8A04",marginBottom:12}]}>
    <Text style={s.heading}>Mağazanız tatil modundadır</Text>
    <Text style={s.help}>{profile.holiday_reactivate_at
      ?"Yeniden açılış: "+shortDate(profile.holiday_reactivate_at)
      :"Ürünler satışa kapalıdır. Yeniden açılış talebinden 24 saat sonra satışlar başlar."}</Text>
    {!profile.holiday_reactivate_at?<Action title="Tekrardan Satışa Aç" disabled={working} onPress={reopenHoliday}/>:null}
  </View>:null}
  {loading?<ActivityIndicator size="large" color={C.blue}/>:null}
  {error?<Text style={s.error}>{error}</Text>:null}
  {notice?<Text style={s.notice}>{notice}</Text>:null}
  {tab==="overview"?<View style={s.panel}>
    <Text style={s.heading}>{isSuper?"Pazaryeri Onay Merkezi":seller?.supplier?.company_name||"Mağazam"}</Text>
    {isSuper?
      ([["Bekleyen tedarikçiler",stats?.suppliers],["Ürün onayı",stats?.products],["Mağaza onayı",stats?.stores],
        ["Reels onayı",stats?.reels]] as Array<[string,Array<{status:string;total:number}>|undefined]>)
       .map(([title,arr])=><View style={s.row} key={title}><Text style={s.text}>{title}</Text>
         <Text style={s.value}>{arr?.find(x=>x.status==="pending")?.total||0}</Text></View>):
      ([["Ürün sayısı",seller?.productCount],["Takipçiler",seller?.followers],
       ["Sohbetler",seller?.conversations]] as Array<[string,unknown]>)
       .map(([title,v])=><View style={s.row} key={title}><Text style={s.text}>{title}</Text>
         <Text style={s.value}>{String(v??0)}</Text></View>)}
    <Text style={s.help}>Standart komisyon %3 · Depo kontrolünde ek %3 · Canlı çok satıcılı tahsilat henüz etkin değil.</Text>
    {!isSuper?<Action title="Çıkış Yap" onPress={()=>void onLogout()}/>:null}
  </View>:null}
  {tab==="orders"?<View style={s.panel}>
    <Text style={s.heading}>{isSuper?"Tüm Siparişler":"Siparişlerim"}</Text>
    <Text style={s.help}>{isSuper?"Tüm şirket ve tedarikçi satışlarının sipariş kayıtlarını ve durumlarını inceleyin.":"Yalnızca sizin ürünlerinizi içeren siparişler listelenir."}</Text>
    {isSuper?adminOrders.length?adminOrders.slice(0,100).map(order=><TouchableOpacity key={String(order.id)} style={s.card}
      onPress={()=>onOpenOrder?.(String(order.id))}>
      <Text style={s.itemTitle}>{order.order_number||"#"+order.id} · {money(order.total_amount)}</Text>
      <Text style={s.text}>{statusMeta(order.status).label} · {String(order.customer_email||"Müşteri")}</Text>
      <Text style={s.help}>Ödeme: {String(order.payment_status||"Beklemede")} · {String(order.payment_method||"—")} · {shortDate(order.created_at||"")}</Text>
      <Text style={s.help}>{(order.items||[]).map(item=>String(item.name||item.productName||item.sku||"Ürün")).slice(0,4).join(", ")}</Text>
      <Text style={[s.help,{color:C.blue}]}>Sipariş içeriği ve durumunu aç →</Text>
    </TouchableOpacity>):<Text style={s.help}>Henüz sipariş bulunmuyor.</Text>
    :supplierOrders.length?supplierOrders.map(order=><View key={String(order.id)} style={s.card}>
      <Text style={s.itemTitle}>Sipariş #{order.order_id} · {money(order.subtotal)}</Text>
      <Text style={s.help}>Durum: {order.status==="paid"?"Ödeme alındı":order.status} · {shortDate(order.created_at)}</Text>
      {(order.items||[]).map((item,index)=><View key={index} style={s.row}>
        <Text style={s.text}>{String(item.name||item.sku||"Ürün")} · {item.boxes||0} koli</Text><Text style={s.value}>{money(item.total||0)}</Text>
      </View>)}
    </View>):<Text style={s.help}>Henüz size ait sipariş bulunmuyor.</Text>}
  </View>:null}
  {isSuper && ["suppliers","products","stores","reels"].includes(tab)?<View style={s.panel}>
    <Text style={s.heading}>{names[tab]} — İnceleme</Text>
    {items.length===0?<Text style={s.help}>Kayıt yok.</Text>:null}
    {items.map((item:Review)=><View key={item.id} style={s.card}>
      <Text style={s.itemTitle}>{item.company_name||item.title||item.content?.name||item.content?.title||"Başvuru"}</Text>
      <Text style={s.help}>#{item.id} · {status[item.status]||item.status}</Text>
      {item.review_note?<Text style={s.help}>Yönetici notu: {item.review_note}</Text>:null}
      {item.status==="pending"?<>
        <Input value={note} onChangeText={setNote} placeholder="Yönetici notu / ret gerekçesi"/>
        <View style={s.actions}>
          <Action title="Onayla" disabled={working} onPress={()=>void send(tab==="suppliers"?
            "/api/admin/marketplace/suppliers/"+item.id+"/decision":
            "/api/admin/marketplace/reviews/"+({products:"product",stores:"store",reels:"reel"} as Record<string,string>)[tab]+"/"+item.id+"/decision",
            {decision:"approved",note})}/>
          <Action title="Reddet" disabled={working||!note.trim()} onPress={()=>void send(tab==="suppliers"?
            "/api/admin/marketplace/suppliers/"+item.id+"/decision":
            "/api/admin/marketplace/reviews/"+({products:"product",stores:"store",reels:"reel"} as Record<string,string>)[tab]+"/"+item.id+"/decision",
            {decision:"rejected",note})}/>
        </View>
      </>:null}
    </View>)}
  </View>:null}
  {!isSuper&&tab==="stores"?<View style={s.panel}>
    <Text style={s.heading}>Mağaza Tasarımı</Text>
    <Input value={storeTitle} onChangeText={setStoreTitle} placeholder="Mağaza başlığı"/>
    <Input value={storeTagline} onChangeText={setStoreTagline} placeholder="Tanıtım metni"/>
    <View style={s.row}><Text style={s.text}>Mağaza logonuz {storeLogo?"✓":""}</Text>
      <Action title={storeLogo?"Logoyu Değiştir":"Logo Ekle"} disabled={mediaBusy} onPress={()=>void selectImage(setStoreLogo)}/></View>
    <View style={s.row}><Text style={s.text}>Mağaza bannerı {storeBanner?"✓":""}</Text>
      <Action title={storeBanner?"Bannerı Değiştir":"Banner Ekle"} disabled={mediaBusy} onPress={()=>void selectImage(setStoreBanner)}/></View>
    <Input value={storeAccent} onChangeText={setStoreAccent} placeholder="Tema rengi (#FACC15)"/>
    <Action title="Tasarımı Onaya Gönder" disabled={working||mediaBusy||!storeTitle.trim()} onPress={()=>{
      if(!/^#[0-9a-fA-F]{6}$/.test(storeAccent)){setError("Tema rengi #RRGGBB biçiminde olmalı.");return;}
      void send("/api/marketplace/seller/store",
        {title:storeTitle,tagline:storeTagline,accent:storeAccent,bannerUrl:storeBanner,logoUrl:storeLogo,
          sections:["banner","categories","products","reels","about"]});
    }}/>
    <Text style={s.help}>Görsel ve gelişmiş blok düzenleme aynı hesabın web satıcı panelinde bulunur.</Text>
    {seller?.storeVersions?.map(v=><View style={s.row} key={v.id}><Text style={s.text}>Tasarım #{v.id}</Text>
       <Text style={s.value}>{status[v.status]||v.status}{v.is_live?" · Yayında":""}</Text></View>)}
  </View>:null}
  {!isSuper&&tab==="returns"?<View style={s.panel}>
    <Text style={s.heading}>İade Takibi</Text>
    <Text style={s.help}>Tedarikçi iade taleplerinin canlı entegrasyonu hazırlanıyor. Henüz doğrulanmış bir iade kaydı gösterilmiyor.</Text>
  </View>:null}
  {!isSuper&&tab==="payments"?<View style={s.panel}>
    <Text style={s.heading}>Ödeme Takibi</Text>
    <Text style={s.help}>Tedarikçi hakedişleri ve ödeme hareketlerinin canlı entegrasyonu henüz etkin değil. Burada doğrulanmamış finansal rakam gösterilmiyor.</Text>
  </View>:null}
  {!isSuper&&tab==="settings"?<View style={s.panel}>
    <Text style={s.heading}>Tedarikçi Ayarları</Text>
    <Text style={s.text}>{profile?.company_name||"Mağazanız"}</Text>
    <View style={s.row}><Text style={s.text}>Hesap</Text><Text style={s.value}>{profile?.is_admin_paused?"Pasif":"Onaylı"}</Text></View>
    <View style={s.row}><Text style={s.text}>Tatil modu</Text><Text style={s.value}>{profile?.is_holiday?"Açık":"Kapalı"}</Text></View>
    {!profile?.is_holiday?<Action title="Hesabımı Tatil Moduna Al" disabled={working} onPress={openHoliday}/>:
      !profile.holiday_reactivate_at?<Action title="Tatil Modunu Kapat" disabled={working} onPress={reopenHoliday}/>:
      <Text style={s.help}>24 saatlik açılış bekleniyor. Planlanan zaman: {shortDate(profile.holiday_reactivate_at)}</Text>}
    {profile?.is_admin_paused?<Action title="Hesabımı Tekrar Satışa Aç" disabled={working}
      onPress={()=>void patch("/api/marketplace/seller/pause",{paused:false},"Hesabınız yeniden aktif edildi.")}/>:null}
  </View>:null}
  {!isSuper&&tab==="products"?<View style={s.panel}>
    <Text style={s.heading}>Ürünlerim</Text>
    <View style={[s.card,{gap:9}]}>
      <Text style={s.itemTitle}>Yeni Ürün Ekle · Admin Onaylı</Text>
      <Input value={newSku} onChangeText={setNewSku} placeholder="Stok kodu (SKU)"/>
      <Input value={newName} onChangeText={setNewName} placeholder="Ürün adı"/>
      <Input value={newCategory} onChangeText={setNewCategory} placeholder="Kategori"/>
      <Input value={newPrice} onChangeText={setNewPrice} placeholder="Fiyat (TL)"/>
      <Input value={newStock} onChangeText={setNewStock} placeholder="Stok adedi"/>
      <Input value={newBoxes} onChangeText={setNewBoxes} placeholder="Koli içi adet"/>
      <Action title={newImage?"Ürün görseli yüklendi ✓":"Ürün Görseli Seç"} disabled={mediaBusy} onPress={()=>void selectImage(setNewImage)}/>
      <Action title="Ürünü Onaya Gönder" disabled={working||mediaBusy} onPress={()=>void addSupplierProduct()}/>
    </View>
    {products.map(p=><View key={String(p.id)} style={s.card}><Text style={s.itemTitle}>{p.latest?.content?.name||p.sku}</Text>
       <Text style={s.help}>{p.sku} · Stok: {p.stock} · {money(p.current_price||p.latest?.content?.price||0)} · {status[p.latest?.status]||"Taslak"}</Text>
       {editingProduct===String(p.id)?<View style={{gap:8}}>
         <Text style={s.help}>Fiyat ve stok anında güncellenir. Diğer ürün değişiklikleri yönetici onayına gönderilir.</Text>
         <Input value={editingPrice} onChangeText={setEditingPrice} placeholder="Yeni fiyat (TL)"/>
         <Input value={editingStock} onChangeText={setEditingStock} placeholder="Yeni stok adedi"/>
         <Action title="Fiyat ve Stok Kaydet" disabled={working} onPress={()=>{
           const price=Number(editingPrice),stock=Number(editingStock);
           if(!Number.isFinite(price)||price<=0||!Number.isSafeInteger(stock)||stock<0){setError("Geçerli fiyat ve stok girin.");return;}
           void patch("/api/marketplace/seller/products/"+p.id+"/quick",{price,stock},"Ürün fiyatı ve stok güncellendi.");
           setEditingProduct(null);
         }}/>
         <Text style={s.itemTitle}>Ürün Bilgileri · Admin Onayı Gerekir</Text>
         <Input value={productDraft.sku} onChangeText={v=>setProductDraft(x=>({...x,sku:v}))} placeholder="Stok Kodu"/>
         <Input value={productDraft.name} onChangeText={v=>setProductDraft(x=>({...x,name:v}))} placeholder="Ürün Adı"/>
         <Input value={productDraft.category} onChangeText={v=>setProductDraft(x=>({...x,category:v}))} placeholder="Kategori"/>
         <Input value={productDraft.brand} onChangeText={v=>setProductDraft(x=>({...x,brand:v}))} placeholder="Marka"/>
         <Input value={productDraft.description} onChangeText={v=>setProductDraft(x=>({...x,description:v}))} placeholder="Açıklama" multiline/>
         <Input value={productDraft.barcode} onChangeText={v=>setProductDraft(x=>({...x,barcode:v}))} placeholder="Barkod"/>
         <Input value={productDraft.unitsPerBox} onChangeText={v=>setProductDraft(x=>({...x,unitsPerBox:v}))} placeholder="Koli İçi Adet"/>
         <Input value={productDraft.minBoxes} onChangeText={v=>setProductDraft(x=>({...x,minBoxes:v}))} placeholder="Minimum Koli"/>
         <Input value={productDraft.leadDays} onChangeText={v=>setProductDraft(x=>({...x,leadDays:v}))} placeholder="Termin Süresi (Gün)"/>
         <Action title={productDraft.imageUrl?"Ürün Görselini Değiştir":"Ürün Görseli Yükle"} disabled={mediaBusy}
           onPress={()=>void selectImage(url=>setProductDraft(x=>({...x,imageUrl:url})))}/>
         <Action title="Bilgileri Yeniden Onaya Gönder" disabled={working||mediaBusy} onPress={()=>{
           const d=productDraft,unitsPerBox=Number(d.unitsPerBox),minBoxes=Number(d.minBoxes),leadDays=Number(d.leadDays);
           if(!d.sku.trim()||!d.name.trim()||!d.category.trim()||!d.imageUrl||
             !Number.isSafeInteger(unitsPerBox)||unitsPerBox<1||!Number.isSafeInteger(minBoxes)||minBoxes<1||
             !Number.isSafeInteger(leadDays)||leadDays<1||leadDays>14){
             setError("Ürün adı, stok kodu, kategori, görsel ve koli bilgilerini kontrol edin.");return;
           }
           void patch("/api/marketplace/seller/products/"+p.id+"/revisions",{
             sku:d.sku.trim(),
             product:{name:d.name.trim(),description:d.description,category:d.category.trim(),brand:d.brand,
               barcode:d.barcode,imageUrl:d.imageUrl,price:Number(p.current_price||p.live?.price||p.latest?.content?.price||1),
               unitsPerBox,minBoxes,leadDays}
           },"Ürün bilgileri yönetici onayına gönderildi.");
           setEditingProduct(null);
         }}/>
       </View>:<Action title="Ürünü Düzenle" onPress={()=>{
         const d=p.live||p.latest?.content||{};
         setEditingProduct(String(p.id));setEditingPrice(String(p.current_price||d.price||""));
         setEditingStock(String(p.stock));
         setProductDraft({sku:String(p.sku||""),name:String(d.name||""),description:String(d.description||""),
           category:String(d.category||""),brand:String(d.brand||""),barcode:String(d.barcode||""),
           imageUrl:String(d.imageUrl||""),unitsPerBox:String(d.unitsPerBox||1),
           minBoxes:String(d.minBoxes||1),leadDays:String(d.leadDays||1)});
       }}/>}
     </View>)}
    <Text style={s.help}>Ürünler aynı tedarikçi hesabıyla web ve mobil panelden yönetilir.</Text>
  </View>:null}
  {!isSuper&&tab==="reels"?<View style={s.panel}><Text style={s.heading}>Mağaza Reels</Text>
    <View style={[s.card,{gap:9}]}>
      <Text style={s.itemTitle}>Yeni Reels Ekle</Text>
      <Input value={reelDraftTitle} onChangeText={setReelDraftTitle} placeholder="Video başlığı"/>
      <Action title={reelDraftVideo?"Video yüklendi ✓":mediaBusy?"Video Yükleniyor…":"MP4 Video Seç"} disabled={mediaBusy} onPress={()=>void selectVideo()}/>
      {mediaBusy&&mediaProgress>0?<Text style={s.help}>Yükleme: %{Math.round(mediaProgress*100)}</Text>:null}
      <Action title={reelDraftCover?"Kapak görseli yüklendi ✓":"Kapak Görseli Ekle (İsteğe Bağlı)"} disabled={mediaBusy} onPress={()=>void selectImage(setReelDraftCover)}/>
      <Text style={s.help}>Kapak eklenmezse mağazada video sessiz önizlenir.</Text>
      <Action title="Reels'i Onaya Gönder" disabled={working||mediaBusy||!reelDraftVideo||!reelDraftTitle.trim()} onPress={()=>void submitReel()}/>
    </View>
    {seller?.reels?.map(r=><View key={r.id} style={s.card}>
      <Text style={s.itemTitle}>{r.title}</Text><Text style={s.help}>{status[r.status]||r.status}{r.is_live?" · Yayında":""}</Text>
      {editingReel===String(r.id)?<View style={{gap:8}}>
        <Input value={reelTitle} onChangeText={setReelTitle} placeholder="Reels başlığı"/>
        <Action title="Tekrar Onaya Gönder" disabled={working||!reelTitle.trim()} onPress={()=>{
          void patch("/api/marketplace/seller/reels/"+r.id,{title:reelTitle.trim(),videoUrl:r.video_url,thumbnailUrl:r.thumbnail_url||null,productId:r.product_id||null},"Reels yeniden admin onayına gönderildi.");
          setEditingReel(null);
        }}/>
      </View>:<Action title="Başlığı Düzenle" onPress={()=>{setEditingReel(String(r.id));setReelTitle(r.title);}}/>}
      <Action title="Reels Sil" disabled={working} onPress={()=>Alert.alert("Reels sil","Video kalıcı olarak silinsin mi?",[
        {text:"Vazgeç",style:"cancel"},
        {text:"Sil",style:"destructive",onPress:()=>{
          void (async()=>{setWorking(true);try{
            await apiFetch("/api/marketplace/seller/reels/"+r.id,{method:"DELETE"});
            await load();setNotice("Reels silindi.");
          }catch(e){setError(e instanceof Error?e.message:"Silinemedi");}finally{setWorking(false);}})();
        }}
      ])}/>
    </View>)}
    <Text style={s.help}>Video ve kapak yüklendiğinde yönetici incelemesinden sonra yayına alınır.</Text>
  </View>:null}
  {!isSuper&&tab==="messages"?<View style={s.panel}>
    <Text style={s.heading}>Müşteri Mesajları</Text>
    {chats.map(c=><TouchableOpacity key={c.id} onPress={()=>setSelectedChat(c.id)} style={s.card}>
      <Text style={s.itemTitle}>Görüşme #{c.id}</Text><Text style={s.help}>{c.latest_message}</Text></TouchableOpacity>)}
    {selectedChat?<View style={s.card}>
      {messages.map(m=><Text key={m.id} style={s.message}>{m.text}</Text>)}
      <Input value={reply} onChangeText={setReply} placeholder="Mesaj yazın" multiline/>
      <Action title="Yanıtla" disabled={working||!reply.trim()} onPress={()=>{
        void send("/api/marketplace/conversations/"+selectedChat+"/messages",{text:reply});setReply("");
      }}/>
      <Action title="Sohbeti Sonlandır" disabled={working} onPress={()=>Alert.alert("Sohbeti Sonlandır","Bu görüşme arşive alınacak. Müşteri yeni sohbet başlatabilecek.",[
        {text:"Vazgeç",style:"cancel"},
        {text:"Sohbeti Kapat",style:"destructive",onPress:()=>{
          void (async()=>{setWorking(true);try{
            await apiFetch("/api/marketplace/conversations/"+selectedChat+"/close",{method:"POST",body:"{}"});
            setSelectedChat(null);setMessages([]);setNotice("Sohbet arşive alındı.");await load();
          }catch(e){setError(e instanceof Error?e.message:"Sohbet kapatılamadı");}finally{setWorking(false);}})();
        }}
      ])}/>
    </View>:null}
    <Text style={s.help}>Yeni görüşmeyi sadece müşteri başlatır.</Text>
  </View>:null}
 </ScrollView>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:C.bg},content:{paddingHorizontal:16,paddingTop:10,paddingBottom:70},
 tabs:{flexDirection:"row",flexWrap:"wrap",gap:7,marginVertical:14},
 tab:{borderRadius:12,paddingHorizontal:13,paddingVertical:11,backgroundColor:C.panel,borderWidth:1,borderColor:C.line},
 tabActive:{backgroundColor:C.blue},tabText:{color:C.text2,fontSize:12,fontWeight:"600"},
 tabActiveText:{color:"#FFFFFF"},
 panel:{backgroundColor:C.panel,borderRadius:20,borderWidth:1,borderColor:C.line,padding:16,marginTop:4,gap:12},
 heading:{color:C.text,fontSize:19,fontWeight:"700"},
 row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:C.line,paddingVertical:10,gap:10},
 text:{flex:1,color:C.text,fontSize:13},value:{color:C.text,fontSize:13,fontWeight:"700"},
 help:{color:C.muted,fontSize:11,lineHeight:18},
 card:{borderWidth:1,borderColor:C.line,borderRadius:14,padding:13,gap:8,backgroundColor:C.bg},
 itemTitle:{color:C.text,fontSize:13,fontWeight:"700"},
 input:{borderWidth:1,borderColor:C.line,color:C.text,backgroundColor:C.bg,borderRadius:12,paddingHorizontal:13,paddingVertical:11,fontSize:13},
 actions:{flexDirection:"row",gap:7,flexWrap:"wrap"},
 button:{backgroundColor:C.blue,borderRadius:10,paddingHorizontal:14,paddingVertical:12,alignItems:"center",marginTop:4},
 buttonText:{color:"#FFFFFF",fontSize:12,fontWeight:"700"},
 message:{padding:10,borderRadius:8,backgroundColor:C.panel,color:C.text,fontSize:12},
 error:{color:C.red,fontSize:12,marginBottom:10},
 notice:{color:C.green,fontSize:12,marginBottom:10},
});
