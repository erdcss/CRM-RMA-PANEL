
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { apiFetch } from "../lib/api";
import { C } from "../ui/theme";
import { BackHeader } from "./common";

type Review={id:string;company_name?:string;title?:string;status:string;review_note?:string;
  contact_name?:string;created_at?:string;content?:{name?:string;title?:string}};
type Queue={suppliers:Review[];products:Review[];stores:Review[];reels:Review[]};
type AdminStats={suppliers:Array<{status:string;total:number}>;products:Array<{status:string;total:number}>;
  stores:Array<{status:string;total:number}>;reels:Array<{status:string;total:number}>;conversations:number;quotes:number};
type SupplierStats={supplier:{company_name:string;slug:string};productCount:number;followers:number;conversations:number;openQuotes:number;
  storeVersions:Array<{id:string;status:string;is_live:boolean}>;reels:Array<{id:string;title:string;status:string}>};
type Chat={id:string;latest_message?:string;buyer_user_id:string};
type Msg={id:string;text:string;created_at:string};
type Tab="overview"|"suppliers"|"products"|"stores"|"reels"|"messages";
const names:Record<string,string>={overview:"Genel",suppliers:"Tedarikçiler",products:"Ürünler",stores:"Mağaza",reels:"Reels",messages:"Mesajlar"};
const status:Record<string,string>={pending:"Onay bekliyor",approved:"Onaylandı",rejected:"Reddedildi",requested:"Teklif bekleniyor",offered:"Teklif sunuldu",accepted:"Kabul edildi"};
const Input=({value,onChangeText,placeholder,multiline=false}:{value:string;onChangeText:(x:string)=>void;placeholder:string;multiline?:boolean})=>
  <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.muted}
    multiline={multiline} style={[s.input,multiline&&{minHeight:85,textAlignVertical:"top"}]} autoCapitalize="sentences"/>;
function Action({title,onPress,disabled=false}:{title:string;onPress:()=>void;disabled?:boolean}){
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={[s.button,disabled&&{opacity:0.5}]}>
    <Text style={s.buttonText}>{title}</Text>
  </TouchableOpacity>;
}
export function MarketplaceScreen({isSuper,onBack,onLogout}:{
  isSuper:boolean;onBack:()=>void;onLogout:()=>void|Promise<void>}) {
 const [tab,setTab]=useState<Tab>("overview"),[overview,setOverview]=useState<AdminStats|SupplierStats|null>(null);
 const [queue,setQueue]=useState<Queue|null>(null),[products,setProducts]=useState<any[]>([]);
 const [chats,setChats]=useState<Chat[]>([]),[selectedChat,setSelectedChat]=useState<string|null>(null),[messages,setMessages]=useState<Msg[]>([]);
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [note,setNote]=useState(""),[reply,setReply]=useState("");
 const [storeTitle,setStoreTitle]=useState(""),[storeTagline,setStoreTagline]=useState("");
 const load=useCallback(async()=>{
  setError("");
  try{
   if(isSuper){
    const [a,q]=await Promise.all([
      apiFetch<AdminStats>("/api/admin/marketplace/overview"),
      apiFetch<Queue>("/api/admin/marketplace/review-queue")]);
    setOverview(a);setQueue(q);
   }else{
    const [a,p,c]=await Promise.all([
      apiFetch<SupplierStats>("/api/marketplace/seller/dashboard"),
      apiFetch<any[]>("/api/marketplace/seller/products"),
      apiFetch<Chat[]>("/api/marketplace/conversations")]);
    setOverview(a);setProducts(p);setChats(c);
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
 const stats=overview as AdminStats|null;
 const seller=overview as SupplierStats|null;
 const items=isSuper?(tab==="suppliers"?queue?.suppliers:tab==="products"?queue?.products:tab==="stores"?queue?.stores:tab==="reels"?queue?.reels:[])||[]:[];
 const shownTabs:Tab[]=isSuper?["overview","suppliers","products","stores","reels"]:["overview","stores","products","reels","messages"];
 return <ScrollView style={s.screen} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing}
    onRefresh={()=>{setRefreshing(true);void load();}} tintColor={C.text}/>}>
  <BackHeader title="Pazaryeri Yönetimi" subtitle={isSuper?"Süper yönetim merkezi":"Tedarikçi çalışma alanı"} onBack={isSuper?onBack:()=>void onLogout()}/>
  <View style={s.tabs}>{shownTabs.map(t=><TouchableOpacity key={t} onPress={()=>setTab(t)} style={[s.tab,tab===t&&s.tabActive]}>
      <Text style={[s.tabText,tab===t&&s.tabActiveText]}>{names[t]}</Text></TouchableOpacity>)}</View>
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
    <Action title="Tasarımı Onaya Gönder" disabled={working||!storeTitle.trim()} onPress={()=>void send("/api/marketplace/seller/store",
      {title:storeTitle,tagline:storeTagline,accent:"#FACC15",bannerUrl:null,logoUrl:null,
        sections:["banner","categories","products","reels","about"]})}/>
    <Text style={s.help}>Görsel ve gelişmiş blok düzenleme aynı hesabın web satıcı panelinde bulunur.</Text>
    {seller?.storeVersions?.map(v=><View style={s.row} key={v.id}><Text style={s.text}>Tasarım #{v.id}</Text>
       <Text style={s.value}>{status[v.status]||v.status}{v.is_live?" · Yayında":""}</Text></View>)}
  </View>:null}
  {!isSuper&&tab==="products"?<View style={s.panel}>
    <Text style={s.heading}>Ürünlerim</Text>
    {products.map(p=><View key={String(p.id)} style={s.card}><Text style={s.itemTitle}>{p.latest?.content?.name||p.sku}</Text>
       <Text style={s.help}>{p.sku} · Stok: {p.stock} · {status[p.latest?.status]||"Taslak"}</Text></View>)}
    <Text style={s.help}>Ürün ekleme ve fotoğraf yükleme, aynı veri kaynağını kullanan web panelinde aktif.</Text>
  </View>:null}
  {!isSuper&&tab==="reels"?<View style={s.panel}><Text style={s.heading}>Mağaza Reels</Text>
    {seller?.reels?.map(r=><View key={r.id} style={s.card}><Text style={s.itemTitle}>{r.title}</Text><Text style={s.help}>{status[r.status]||r.status}</Text></View>)}
    <Text style={s.help}>Yeni MP4 video yükleme, aynı satıcı hesabının web panelinde kullanılabilir.</Text>
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
