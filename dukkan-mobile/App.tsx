import React,{useCallback,useEffect,useState} from "react";
import * as SecureStore from "expo-secure-store";
import {Image} from "react-native";
import {login,availableStores,setStoreSession,clearStoreSession,list,summary,report,settings,add,setStatus,getSaleDocument,type StoreInfo} from "./remote-db";
import {shareSalesInvoicePdf} from "./invoice-pdf";
import {DUKKAN_THEME} from "./design-system";
import {ActivityIndicator,Alert,KeyboardAvoidingView,Platform,Pressable,SafeAreaView,ScrollView,StatusBar,StyleSheet,Text,TextInput,View} from "react-native";
import {StatusBar as ExpoStatusBar} from "expo-status-bar";
import {today,type Collection,type Form,type Line,type RecordRow} from "./local-db";


type Tab="dashboard"|"invoices"|"products"|"movements"|"parties"|"ledger"|"orders"|"banks"|"cash_movements"|"payments"|"instruments"|"report"|"settings";
type Field={key:string;label:string;kind?:"text"|"number"|"choice"|"party"|"product"|"bank";options?:string[];required?:boolean};
const TABS:{key:Tab;title:string}[]=[
 {key:"dashboard",title:"Genel Bakış"},{key:"invoices",title:"Faturalar / İadeler"},{key:"products",title:"Ürün ve Stok"},
 {key:"movements",title:"Stok Hareketleri"},{key:"parties",title:"Cari Hesaplar"},{key:"ledger",title:"Cari Hareketler"},
 {key:"orders",title:"Siparişler"},{key:"banks",title:"Bankalar"},{key:"cash_movements",title:"Kasa"},
 {key:"payments",title:"Tahsilat / Ödeme"},{key:"instruments",title:"Çek / Senet"},{key:"report",title:"Raporlar"},{key:"settings",title:"Ayarlar / Yedek"}
];
const LABEL:Record<string,string>={sale:"Satış",purchase:"Alış",sale_return:"Satış İadesi",purchase_return:"Alış İadesi",customer:"Müşteri",supplier:"Tedarikçi",both:"Her İkisi",collection:"Tahsilat",payment:"Ödeme",cash:"Kasa",bank:"Banka",cheque:"Çek",note:"Senet",received:"Alınan",issued:"Verilen",pending:"Bekliyor",collected:"Tahsil edildi",bounced:"Karşılıksız",cancelled:"İptal",completed:"Tamamlandı",open:"Açık",increase:"Stok Girişi",decrease:"Stok Çıkışı",in:"Giriş",out:"Çıkış"};
const money=(c:unknown)=> (Number(c||0)/100).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const qty=(v:unknown)=> (Number(v||0)/1000).toLocaleString("tr-TR",{maximumFractionDigits:3});
const val=(v:unknown)=>v===null||v===undefined||v===""?"—":String(LABEL[String(v)]||v);
const f={white:"#ffffff",bg:"#f1f5fb",ink:"#112444",muted:"#7688a3",amber:"#67d5f5",border:"#e0e9f5",green:"#128a71",blue:"#1b64ca",deep:"#0b1e3c"};
const FIELDS:Record<string,Field[]>={
 party:[{key:"name",label:"Cari adı",required:true},{key:"kind",label:"Cari türü",kind:"choice",options:["customer","supplier","both"]},{key:"tax",label:"Vergi / TC no"},{key:"phone",label:"Telefon"},{key:"email",label:"E-posta"},{key:"address",label:"Adres"}],
 productEdit:[{key:"code",label:"Stok kodu",required:true},{key:"barcode",label:"Barkod"},{key:"name",label:"Ürün adı",required:true},{key:"unit",label:"Birim",kind:"choice",options:["Adet","Koli","Paket","Kg","Metre"]},{key:"purchase",label:"Alış fiyatı (TL)",kind:"number",required:true},{key:"sale",label:"Satış fiyatı (TL)",kind:"number",required:true}],
 product:[{key:"code",label:"Stok kodu",required:true},{key:"barcode",label:"Barkod"},{key:"name",label:"Ürün adı",required:true},{key:"unit",label:"Birim",kind:"choice",options:["Adet","Koli","Paket","Kg","Metre"]},{key:"purchase",label:"Alış fiyatı (TL)",kind:"number",required:true},{key:"sale",label:"Satış fiyatı (TL)",kind:"number",required:true}],
 invoice:[{key:"kind",label:"Fatura türü",kind:"choice",options:["sale","purchase","sale_return","purchase_return"]},{key:"date",label:"Tarih (YYYY-AA-GG)",required:true},{key:"partyId",label:"Cari hesap",kind:"party",required:true},{key:"notes",label:"Açıklama"}],
 stock:[{key:"productId",label:"Ürün",kind:"product",required:true},{key:"direction",label:"Hareket",kind:"choice",options:["increase","decrease"]},{key:"qty",label:"Miktar",kind:"number",required:true},{key:"notes",label:"Açıklama"}],
 order:[{key:"kind",label:"Sipariş türü",kind:"choice",options:["sale","purchase"]},{key:"number",label:"Sipariş numarası",required:true},{key:"date",label:"Tarih (YYYY-AA-GG)",required:true},{key:"partyId",label:"Cari hesap",kind:"party",required:true},{key:"notes",label:"Açıklama"}],
 payment:[{key:"kind",label:"İşlem",kind:"choice",options:["collection","payment"]},{key:"partyId",label:"Cari hesap",kind:"party",required:true},{key:"method",label:"Ödeme aracı",kind:"choice",options:["cash","bank"]},{key:"bankId",label:"Banka hesabı",kind:"bank"},{key:"amount",label:"Tutar (TL)",kind:"number",required:true},{key:"date",label:"Tarih (YYYY-AA-GG)",required:true},{key:"notes",label:"Açıklama"}],
 bank:[{key:"name",label:"Banka / hesap adı",required:true},{key:"iban",label:"IBAN"}],
 bankMovement:[{key:"bankId",label:"Banka hesabı",kind:"bank",required:true},{key:"direction",label:"İşlem",kind:"choice",options:["in","out"]},{key:"amount",label:"Tutar (TL)",kind:"number",required:true},{key:"notes",label:"Açıklama",required:true}],
 cashMovement:[{key:"direction",label:"İşlem",kind:"choice",options:["in","out"]},{key:"amount",label:"Tutar (TL)",kind:"number",required:true},{key:"notes",label:"Açıklama",required:true}],
 instrument:[{key:"kind",label:"Belge türü",kind:"choice",options:["cheque","note"]},{key:"direction",label:"İşlem",kind:"choice",options:["received","issued"]},{key:"partyId",label:"Cari hesap",kind:"party",required:true},{key:"number",label:"Evrak numarası",required:true},{key:"amount",label:"Tutar (TL)",kind:"number",required:true},{key:"dueDate",label:"Vade (YYYY-AA-GG)",required:true},{key:"bankName",label:"Banka"},{key:"notes",label:"Açıklama"}],
 settings:[{key:"company",label:"İşletme unvanı",required:true},{key:"tax",label:"Vergi numarası"},{key:"phone",label:"Telefon"},{key:"address",label:"Adres"}]
};
const ACTIONS:Record<Tab,{kind:string;label:string}[]>={
 dashboard:[{kind:"invoice",label:"Yeni Satış"},{kind:"product",label:"Ürün Ekle"},{kind:"party",label:"Cari Ekle"},{kind:"payment",label:"Tahsilat"}],
 invoices:[{kind:"invoice",label:"Yeni Fatura"}],products:[{kind:"product",label:"Yeni Ürün"},{kind:"stock",label:"Stok Düzelt"}],
 movements:[{kind:"stock",label:"Stok Düzelt"}],parties:[{kind:"party",label:"Yeni Cari"}],ledger:[{kind:"payment",label:"Tahsilat / Ödeme"}],
 orders:[{kind:"order",label:"Yeni Sipariş"}],banks:[{kind:"bank",label:"Banka Ekle"},{kind:"bankMovement",label:"Banka Hareketi"}],
 cash_movements:[{kind:"cashMovement",label:"Nakit Giriş / Çıkış"}],payments:[{kind:"payment",label:"Tahsilat / Ödeme"}],
 instruments:[{kind:"instrument",label:"Yeni Çek / Senet"}],report:[],settings:[{kind:"settings",label:"Bilgileri Düzenle"}]
};
const LABELS:Record<string,string>={invoices:"Fatura",products:"Ürün",movements:"Stok",parties:"Cari",ledger:"Cari Hareket",orders:"Sipariş",banks:"Banka",cash_movements:"Kasa",payments:"Ödeme",instruments:"Evrak"};
function moneyStyle(n:number){return n<0?{color:"#bd524e"}:{color:f.green};}
function StoreApp({session,onLogout,onSwitch}:{session:ActiveSession;onLogout:()=>void;onSwitch:(store:StoreInfo)=>void}){
 const [tab,setTab]=useState<Tab>("dashboard");
 const [records,setRecords]=useState<RecordRow[]>([]);
 const [parties,setParties]=useState<RecordRow[]>([]);
 const [products,setProducts]=useState<RecordRow[]>([]);
 const [banks,setBanks]=useState<RecordRow[]>([]);
 const [sums,setSums]=useState<any>({});
 const [monthly,setMonthly]=useState<RecordRow[]>([]);
 const [company,setCompany]=useState("İşletmem");
 const [existingSettings,setExistingSettings]=useState<Record<string,string>>({});
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const [formType,setFormType]=useState<string|null>(null);
 const [data,setData]=useState<Form>({});
 const [lines,setLines]=useState<Line[]>([{productId:"",qty:"1",price:"0",vat:"20"}]);
 const [filter,setFilter]=useState("");
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [pdfBusy,setPdfBusy]=useState<number|null>(null);
 const openInvoicePdf=async(invoice:RecordRow)=>{
   const invoiceId=Number(invoice.id);
   if(!Number.isSafeInteger(invoiceId)||invoiceId<1||pdfBusy!==null)return;
   setPdfBusy(invoiceId);
   try{
     const document=await getSaleDocument(invoiceId);
     await shareSalesInvoicePdf(document);
   }catch(e){Alert.alert("PDF hazırlanamadı",(e as Error).message);}
   finally{setPdfBusy(null);}
 };

 const reload=useCallback(async()=>{
  try{
   const cashier=session.store.role==="cashier";
   const [p,pr,b,s,sets]=await Promise.all([list("parties"),list("products"),cashier?Promise.resolve([]):list("banks"),cashier?Promise.resolve({}):summary(),settings()]);
   setParties(p);setProducts(pr);setBanks(b);setSums(s);setExistingSettings(sets);setCompany(sets.company||"İşletmem");
   if(tab==="report")setMonthly((await report()).monthly);
   else if(tab==="dashboard")setRecords((await list("invoices")).slice(0,10));
   else if(tab==="settings")setRecords([]);
   else setRecords(await list(tab as Collection));
   setError("");
  }catch(e){setError((e as Error).message);}finally{setReady(true);}
 },[tab,refresh,session.store.id]);
 useEffect(()=>{void reload();},[reload]);
 const push=(field:string,value:string)=>setData(old=>({...old,[field]:value}));
 const open=(kind:string)=>{
  if(["invoice","order"].includes(kind)&&products.length===0)return Alert.alert("Önce ürün ekleyin","Sipariş ve fatura için ürün kartı oluşturmalısınız.");
  if(["invoice","order","payment","instrument"].includes(kind)&&parties.length===0)return Alert.alert("Önce cari hesap ekleyin","Bu işlem için cari hesap gerekiyor.");
  setFormType(kind);
  const defaults:Record<string,Form>={
   invoice:{kind:"sale",date:today()},order:{kind:"sale",date:today()},product:{unit:"Adet",purchase:"0",sale:"0"},
   party:{kind:"customer"},stock:{direction:"increase",qty:"1"},
   payment:{kind:"collection",method:"cash",date:today()},
   cashMovement:{direction:"in"},bankMovement:{direction:"in"},instrument:{kind:"cheque",direction:"received",dueDate:today()},
   settings:existingSettings
  };
  setData(defaults[kind]||{});
  setLines([{productId:"",qty:"1",price:"0",vat:"20"}]);
 };
 const submit=async()=>{
  if(!formType||busy)return;
  if(["invoice","order"].includes(formType)){
   if(lines.some(x=>!x.productId||Number(x.qty)<=0))return Alert.alert("Ürün satırlarını doldurun","Her ürün için miktar ve fiyat seçilmelidir.");
  }
  if(formType==="payment"&&data.method==="bank"&&!data.bankId)return Alert.alert("Banka seçiniz");
  setBusy(true);
  try{
   const payload={...data,lines};
   const saved=await add(formType,payload);
   setFormType(null);setRefresh(x=>x+1);
   Alert.alert("Başarılı",formType==="invoice"?"Fatura kaydedildi. Otomatik 14 haneli numara: "+saved.invoice_no:"İşlem ortak mağaza veritabanına kaydedildi.");
  }catch(e){Alert.alert("İşlem kaydedilemedi",(e as Error).message);}
  finally{setBusy(false);}
 };
 const statusAction=(kind:"order"|"instrument",r:RecordRow)=>{
  Alert.alert("Durum değiştir","İşlemi kapatmak kayıtları silmez; tahsilat ayrıca girilmelidir.",[
   {text:"Vazgeç",style:"cancel"},
   {text:"Tamamlandı",onPress:async()=>{try{await setStatus(kind,Number(r.id),kind==="order"?"completed":"collected");setRefresh(x=>x+1);}catch(e){Alert.alert("Hata",(e as Error).message);}}},
   {text:"İptal",style:"destructive",onPress:async()=>{try{await setStatus(kind,Number(r.id),"cancelled");setRefresh(x=>x+1);}catch(e){Alert.alert("Hata",(e as Error).message);}}}
  ]);
 };
 const doExport=async()=>Alert.alert("Merkezi kayıtlar","Kayıtlar yetkili mağazanın sunucusunda tutulur. Eski yerel SQLite yedekleri otomatik aktarılmaz.");
 const doImport=async()=>Alert.alert("Yedek aktarımı","Eski mobil/Windows SQLite yedeğini saklayın. Doğrulanmış aktarım tamamlanmadan kayıtlar merkezi sisteme yüklenmez.");
 const shown=records.filter(r=>!filter||Object.values(r).some(v=>String(v??"").toLocaleLowerCase("tr-TR").includes(filter.toLocaleLowerCase("tr-TR"))));
 const rowTitle=(r:RecordRow)=>{
  if(tab==="dashboard"||tab==="invoices")return String(r.number)+" · "+val(r.kind);
  if(tab==="products")return String(r.name);
  if(tab==="parties")return String(r.name);
  if(tab==="banks")return String(r.name);
  if(tab==="instruments")return String(r.number)+" · "+val(r.kind);
  if(tab==="orders")return String(r.number)+" · "+val(r.kind);
  if(tab==="payments")return val(r.kind)+" · "+val(r.party_name);
  if(tab==="movements")return String(r.product_name);
  if(tab==="ledger")return String(r.party_name);
  return String(r.description||r.created_at||"Kayıt");
 };
 const rowSubtitle=(r:RecordRow)=>[r.party_name,r.code,r.date,r.due_date,r.created_at,r.kind&&LABEL[String(r.kind)]].filter(Boolean).join(" · ");
 const rowAmount=(r:RecordRow)=>{
  if(tab==="products")return qty(r.stock_milli)+" "+val(r.unit);
  if(tab==="parties"||tab==="banks")return money(r.balance);
  if(tab==="movements")return qty(r.delta_milli);
  if("total_cents" in r)return money(r.total_cents);
  if("amount_cents" in r)return money(r.amount_cents);
  return "";
 };
 const actionStyles=styles.primary;
 const cashier=session.store.role==="cashier";
 const canManage=["owner","manager"].includes(session.store.role);
 const visibleTabs=TABS.filter(t=>t.key!=="cash_movements"&&(cashier?!["products","movements","ledger","banks","payments","instruments","report","settings"].includes(t.key):true));
 const visibleActions=(selected:Tab)=>ACTIONS[selected].filter(a=>!["settings","cashMovement"].includes(a.kind)&&(!cashier||!["product","stock","bank","bankMovement","instrument"].includes(a.kind))&&(!["product","stock"].includes(a.kind)||canManage));
 const editProduct=(item:RecordRow)=>{if(!canManage)return;setData({id:item.id,code:item.code,name:item.name,barcode:item.barcode,unit:item.unit,purchase:Number(item.purchase_cents)/100,sale:Number(item.sale_cents)/100});setFormType("productEdit");};

 const fieldOptions=(field:Field)=>{
  if(field.kind==="party")return parties.map(x=>({id:String(x.id),name:String(x.name)}));
  if(field.kind==="product")return products.map(x=>({id:String(x.id),name:String(x.name)+" · "+qty(x.stock_milli)}));
  if(field.kind==="bank")return banks.map(x=>({id:String(x.id),name:String(x.name)}));
  return (field.options||[]).map(x=>({id:x,name:LABEL[x]||x}));
 };
 const lineTotal=lines.reduce((a,l)=>a+(Number(l.qty)||0)*(Number(l.price)||0)*(1+(Number(l.vat)||0)/100),0);
 const fieldView=(field:Field)=><View key={field.key} style={styles.field}>
  <Text style={styles.label}>{field.label}{field.required?" *":""}</Text>
  {["choice","party","product","bank"].includes(field.kind||"")?
   <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={{flexGrow:0}}>
    {fieldOptions(field).map(opt=><Pressable key={opt.id} onPress={()=>push(field.key,opt.id)} style={[styles.chip,String(data[field.key]||"")===opt.id?styles.chipActive:null]}><Text style={{fontSize:12,color:String(data[field.key]||"")===opt.id?"white":f.ink}}>{opt.name}</Text></Pressable>)}
    {fieldOptions(field).length===0&&<Text style={styles.hint}>Önce ilgili kartı oluşturun.</Text>}
   </ScrollView>:
   <TextInput value={String(data[field.key]??"")} onChangeText={s=>push(field.key,s)} placeholder={field.label}
     placeholderTextColor="#97a4b5" style={styles.input} autoCapitalize="none" keyboardType={field.kind==="number"?"decimal-pad":"default"}/>}
 </View>;
 const lineView=(line:Line,i:number)=><View key={i} style={styles.line}>
  <Text style={styles.label}>Ürün {i+1}</Text>
  <ScrollView horizontal style={{flexGrow:0}} showsHorizontalScrollIndicator={false}>
   {products.map(p=><Pressable key={String(p.id)} style={[styles.chip,String(line.productId)===String(p.id)?styles.chipActive:null]} onPress={()=>{
    setLines(x=>x.map((v,n)=>n!==i?v:{...v,productId:String(p.id),price:String(Number(["purchase","purchase_return"].includes(data.kind)?p.purchase_cents:p.sale_cents)/100)}));
   }}><Text style={{fontSize:12,color:String(line.productId)===String(p.id)?"white":f.ink}}>{p.name}</Text></Pressable>)}
  </ScrollView>
  <View style={styles.lineInputRow}>{(["qty","price","vat"] as const).map(key=><View key={key} style={{flex:1}}>
    <Text style={styles.smallLabel}>{key==="qty"?"Adet":key==="price"?"Fiyat TL":"KDV %"}</Text>
    <TextInput style={styles.input} value={String(line[key])} keyboardType="decimal-pad" onChangeText={txt=>setLines(x=>x.map((v,n)=>n===i?{...v,[key]:txt}:v))}/>
   </View>)}
  </View>
  {lines.length>1&&<Pressable onPress={()=>setLines(x=>x.filter((_,n)=>n!==i))}><Text style={{color:"#b24a53",fontWeight:"700",marginTop:8}}>Satırı Kaldır</Text></Pressable>}
 </View>;
 return <SafeAreaView style={styles.safe}><ExpoStatusBar style="light"/><StatusBar barStyle="light-content" backgroundColor={f.ink}/>
  <View style={styles.header}><View><Text style={styles.overline}>ÇALIŞKAN DÜKKAN · MOBİL</Text><Text style={styles.brand}>{company}</Text><Text style={styles.headerSub}>{session.user.username} · {session.store.role}</Text></View><View style={{alignItems:"flex-end",gap:6}}><View style={styles.offline}><Text style={{color:"#89f0c8",fontSize:11,fontWeight:"800"}}>● BAĞLANTILI</Text></View><Pressable onPress={onLogout}><Text style={{color:"white",fontSize:11}}>Çıkış Yap</Text></Pressable></View></View>
  <ScrollView horizontal style={styles.nav} contentContainerStyle={styles.navInner} showsHorizontalScrollIndicator={false}>
   {visibleTabs.map(t=><Pressable key={t.key} style={[styles.tab,tab===t.key?styles.selectedTab:null]} onPress={()=>{setTab(t.key);setFilter("");setFormType(null);}}><Text style={[styles.tabText,tab===t.key?{color:"white"}:null]}>{t.title}</Text></Pressable>)}
  </ScrollView>
  {session.stores.length>1&&<ScrollView horizontal contentContainerStyle={{gap:6,padding:8}} style={{flexGrow:0}}>{session.stores.map(store=><Pressable key={String(store.id)} onPress={()=>onSwitch(store)} style={[styles.chip,session.store.id===store.id?styles.chipActive:null]}><Text style={{color:session.store.id===store.id?"white":f.ink}}>{store.name}</Text></Pressable>)}</ScrollView>}
   <ScrollView key={tab+session.store.id} style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled">
   <View style={styles.pageHead}><Text style={styles.pageTitle}>{TABS.find(x=>x.key===tab)?.title}</Text><Text style={styles.pageNote}>{tab==="dashboard"?"Güncel mağaza bilgileri ve hızlı işlemler":tab==="settings"?"Güvenli hesap ve merkezi veri yönetimi":"Mağazanızın güncel kayıtları"}</Text></View>
   {error!==""&&<Text style={styles.error}>{error}</Text>}
   {!ready?<ActivityIndicator color={f.ink} size="large"/>:null}
   {tab==="dashboard"&&<View style={styles.dashboardBanner}>
      <View><Text style={styles.welcomeEyebrow}>MERKEZİ İŞLETME PANELİ</Text><Text style={styles.welcomeTitle}>Bugün ne yapalım?</Text>
      <Text style={styles.welcomeSub}>Satış, stok ve carilerinizi tek yerden yönetin.</Text></View>
      <View style={styles.quickActions}>
       {([{label:"Satış",kind:"invoice",color:"#d5f3ff"},{label:"Yeni Ürün",kind:"product",color:"#e3eeff"},{label:"Cari",kind:"party",color:"#e0f8ee"},{label:"Tahsilat",kind:"payment",color:"#f8edda"}] as const)
         .filter(a=>!cashier||!["product","payment"].includes(a.kind))
         .filter(a=>a.kind!=="product"||canManage)
         .map(a=><Pressable key={a.kind} onPress={()=>open(a.kind)} style={[styles.quickButton,{backgroundColor:a.color}]}>
          <Text style={styles.quickLabel}>＋ {a.label}</Text>
         </Pressable>)}
      </View>
     </View>}
    {tab==="dashboard"&&!cashier&&<View style={styles.cards}>
     {([["Net Satış",sums.sales],["Net Alış",sums.purchases],["Alacaklar",sums.receivables],["Borçlar",sums.payables],["Kasa",sums.cash],["Banka",sums.bank],["Stok Değeri",sums.stockCost]] as [string,number][]).map(([name,value])=>
      <View key={name} style={[styles.stat,name==="Net Satış"?styles.statFeatured:null]}><Text style={styles.statName}>{name}</Text><Text style={styles.statValue}>{money(value)}</Text></View>)}
     <View style={styles.stat}><Text style={styles.statName}>Ürün Sayısı</Text><Text style={styles.statValue}>{sums.products||0}</Text></View>
    </View>}
   {tab==="report"&&<View><View style={styles.cards}><View style={styles.stat}><Text style={styles.statName}>Faturalar</Text><Text style={styles.statValue}>{sums.documents||0}</Text></View><View style={styles.stat}><Text style={styles.statName}>Geciken Çek / Senet</Text><Text style={styles.statValue}>{sums.overdue||0}</Text></View></View>
     <Text style={styles.groupTitle}>Aylık alış / satış</Text>{monthly.map(r=><View style={styles.row} key={String(r.month)}><Text style={styles.rowTitle}>{r.month}</Text><Text style={styles.rowNote}>Satış {money(r.sales)}   ·   Alış {money(r.purchases)}</Text></View>)}</View>}
   {tab==="settings"&&<View><View style={styles.card}><Text style={styles.groupTitle}>Veriler ve Güvenlik</Text><Text style={styles.hint}>Bu uygulama Çalışkan Admin tarafından atanan mağazanın PostgreSQL veritabanını kullanır. Önceki sürümdeki SQLite verileri otomatik aktarılmaz.</Text>
    <Pressable disabled={busy} style={[styles.primary,{marginVertical:8}]} onPress={doExport}><Text style={styles.primaryText}>Yerel / Merkezi Veri Bilgisi</Text></Pressable>
    <Pressable disabled={busy} style={[styles.secondary,{marginVertical:8}]} onPress={doImport}><Text style={styles.secondaryText}>Eski Yedekler Hakkında</Text></Pressable>
    <Text style={styles.hint}>Önemli: Eski çevrimdışı SQLite kayıtları sunucuya otomatik aktarılmaz; yerel yedeklerinizi koruyun.</Text></View>
    <View style={styles.card}><Text style={styles.groupTitle}>Dahili Muhasebe Uyarısı</Text><Text style={styles.hint}>e-Fatura/e-Arşiv oluşturma ve GİB'e gönderim yoktur. Resmî muhasebe belgesi olarak kullanmayın.</Text></View></View>}
   {visibleActions(tab).length>0&&<ScrollView horizontal style={{flexGrow:0,marginBottom:17}} showsHorizontalScrollIndicator={false}>
    {visibleActions(tab).map(x=><Pressable key={x.kind} onPress={()=>open(x.kind)} style={styles.primary}><Text style={styles.primaryText}>＋ {x.label}</Text></Pressable>)}
   </ScrollView>}
   {!["settings","report"].includes(tab)&&<View>
    {tab!=="dashboard"&&<TextInput placeholder="Kayıtlarda ara..." placeholderTextColor={f.muted} value={filter} onChangeText={setFilter} style={[styles.input,{marginBottom:14}]}/>}
    <Text style={styles.groupTitle}>{tab==="dashboard"?"Son İşlemler":"Kayıtlar"} <Text style={{color:f.blue}}>({shown.length})</Text></Text>
    {shown.length===0?<View style={styles.empty}><Text style={styles.emptyTitle}>Henüz kayıt yok</Text><Text style={styles.hint}>Yeni bir kayıt oluşturarak başlayabilirsiniz.</Text></View>:shown.slice(0,250).map((r,i)=><Pressable onPress={()=>{if(tab==="products"){editProduct(r);return;}if("status" in r&&tab==="instruments"&&String(r.status)==="pending")statusAction("instrument",r);}}
      key={String(r.id||i)} style={styles.row}><View style={{flex:1}}><Text numberOfLines={2} style={styles.rowTitle}>{rowTitle(r)}</Text><Text numberOfLines={2} style={styles.rowNote}>{rowSubtitle(r)}</Text></View><View style={{alignItems:"flex-end",maxWidth:130}}><Text style={styles.rowAmount}>{rowAmount(r)}</Text>
        {(tab==="invoices"||tab==="dashboard")&&["sale","sale_return"].includes(String(r.kind))&&
          <Pressable accessibilityRole="button" disabled={pdfBusy!==null} onPress={()=>void openInvoicePdf(r)} style={styles.pdfButton}>
           <Text style={styles.pdfButtonText}>{pdfBusy===Number(r.id)?"Hazırlanıyor...":"↓ Satış PDF"}</Text>
          </Pressable>}
        {r.status&&<Text style={styles.badge}>{val(r.status)}</Text>}</View></Pressable>)}
    {shown.length>250&&<Text style={styles.hint}>İlk 250 kayıt gösteriliyor. Arama ile filtreleyin.</Text>}
   </View>}
  </ScrollView>
  <View style={styles.bottomDock}>
    {([{key:"dashboard",title:"Özet"},{key:"invoices",title:"Faturalar"},{key:"products",title:"Ürünler"},{key:"parties",title:"Cariler"},{key:"report",title:"Raporlar"}] as {key:Tab;title:string}[])
      .filter(t=>!cashier||!["products","report"].includes(t.key))
      .map(t=><Pressable key={t.key} accessibilityRole="button" onPress={()=>{setTab(t.key);setFilter("");setFormType(null);}}
        style={[styles.dockButton,tab===t.key?styles.dockActive:null]}>
        <Text style={[styles.dockText,tab===t.key?styles.dockTextActive:null]}>{t.title}</Text>
      </Pressable>)}
  </View>
  {formType&&<KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={styles.overlay}>
   <View style={styles.modal}><View style={styles.modalHead}><Text style={styles.modalTitle}>{formType==="productEdit"?"Ürünü Düzenle":ACTIONS[tab].find(a=>a.kind===formType)?.label||"Yeni İşlem"}</Text><Pressable onPress={()=>setFormType(null)}><Text style={{fontSize:22,color:f.ink}}>×</Text></Pressable></View>
    <ScrollView contentContainerStyle={{padding:20,paddingBottom:35}} keyboardShouldPersistTaps="always">
     {formType==="invoice"&&<Text style={styles.hint}>Fatura numarası kayıtta otomatik atanacaktır (14 haneli).</Text>}
      {(FIELDS[formType]||[]).filter(field=>!(formType==="payment"&&field.key==="bankId"&&data.method!=="bank")).map(fieldView)}
     {["invoice","order"].includes(formType)&&<View>
       <Text style={styles.groupTitle}>Ürün Kalemleri</Text><Text style={styles.hint}>Ürün · Miktar · Birim fiyat · KDV · Satır tutarı</Text>
       {lines.map(lineView)}
       <Pressable style={styles.secondary} onPress={()=>setLines(x=>[...x,{productId:"",qty:"1",price:"0",vat:"20"}])}><Text style={styles.secondaryText}>＋ Ürün Satırı Ekle</Text></Pressable>
       <Text style={styles.total}>Genel toplam (KDV dahil): {lineTotal.toLocaleString("tr-TR",{style:"currency",currency:"TRY"})}</Text>
      </View>}
     <Pressable disabled={busy} style={styles.primary} onPress={submit}><Text style={styles.primaryText}>{busy?"Kaydediliyor...":"İşlemi Kaydet"}</Text></Pressable>
    </ScrollView>
   </View>
  </KeyboardAvoidingView>}
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:f.bg},header:{backgroundColor:f.ink,paddingHorizontal:20,paddingTop:Platform.OS==="android"?20:14,paddingBottom:21,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
 overline:{color:f.amber,fontSize:10,fontWeight:"800",letterSpacing:1.4},brand:{color:"white",fontSize:25,fontWeight:"900",marginTop:8},headerSub:{color:"#9eb0c4",fontSize:11,marginTop:3},
 offline:{backgroundColor:"#244a48",padding:8,borderRadius:13},
 nav:{flexGrow:0,maxHeight:57,backgroundColor:"white",borderBottomWidth:1,borderColor:f.border},
 navInner:{alignItems:"center",paddingHorizontal:10,gap:8},tab:{backgroundColor:"#eef2f7",paddingHorizontal:14,paddingVertical:10,borderRadius:14},selectedTab:{backgroundColor:f.ink},
 tabText:{fontSize:12,fontWeight:"700",color:f.ink},content:{flex:1},contentInner:{padding:18,paddingBottom:85},pageHead:{marginBottom:19},pageTitle:{fontSize:23,fontWeight:"800",color:f.ink},pageNote:{fontSize:12,color:f.muted,marginTop:5},
 cards:{flexDirection:"row",flexWrap:"wrap",gap:10,marginBottom:18},stat:{backgroundColor:"white",borderRadius:14,padding:15,borderWidth:1,borderColor:f.border,width:"48%",minWidth:145},statName:{color:f.muted,fontSize:11,fontWeight:"600"},statValue:{color:f.ink,fontSize:18,fontWeight:"800",marginTop:13},
 groupTitle:{fontSize:16,color:f.ink,fontWeight:"800",marginBottom:12},primary:{backgroundColor:f.ink,borderRadius:12,paddingHorizontal:17,paddingVertical:13,marginRight:9,alignItems:"center",justifyContent:"center"},primaryText:{color:"white",fontWeight:"800",fontSize:13},
 secondary:{backgroundColor:"#eef2f8",borderRadius:12,padding:14,alignItems:"center",borderWidth:1,borderColor:f.border},secondaryText:{fontWeight:"800",fontSize:13,color:f.ink},
 card:{backgroundColor:"white",borderRadius:15,borderWidth:1,borderColor:f.border,padding:18,marginBottom:15},row:{backgroundColor:"white",borderWidth:1,borderColor:f.border,borderRadius:14,padding:16,marginBottom:9,flexDirection:"row",alignItems:"center",gap:14},
 rowTitle:{fontSize:14,fontWeight:"800",color:f.ink},rowNote:{fontSize:11,color:f.muted,marginTop:6},rowAmount:{fontSize:14,fontWeight:"800",color:f.ink},badge:{fontSize:10,color:f.green,marginTop:5,fontWeight:"800"},
 hint:{fontSize:12,color:f.muted,lineHeight:19},empty:{backgroundColor:"white",borderWidth:1,borderColor:f.border,borderRadius:14,padding:25,alignItems:"center",gap:8},emptyTitle:{color:f.ink,fontWeight:"700"},
 overlay:{position:"absolute",top:0,bottom:0,left:0,right:0,backgroundColor:"#0a1c33ab",justifyContent:"flex-end"},modal:{backgroundColor:"white",borderTopLeftRadius:25,borderTopRightRadius:25,maxHeight:"94%",minHeight:"50%"},
 modalHead:{padding:19,paddingHorizontal:21,borderBottomWidth:1,borderColor:f.border,flexDirection:"row",justifyContent:"space-between"},modalTitle:{fontSize:18,color:f.ink,fontWeight:"800"},
 field:{marginBottom:17},label:{fontSize:12,color:"#475971",fontWeight:"800",marginBottom:7},input:{backgroundColor:"white",borderWidth:1,borderColor:"#d6dee9",borderRadius:11,paddingHorizontal:12,paddingVertical:10,fontSize:14,color:f.ink,minHeight:45},
 chip:{borderRadius:11,backgroundColor:"#eef2f6",paddingHorizontal:14,paddingVertical:11,marginRight:8,marginBottom:5},chipActive:{backgroundColor:f.ink},
 line:{padding:14,backgroundColor:"#f5f8fb",borderWidth:1,borderColor:f.border,borderRadius:12,marginBottom:13},lineInputRow:{flexDirection:"row",gap:9,marginTop:12},smallLabel:{fontSize:10,color:f.muted,marginBottom:6},total:{fontSize:15,fontWeight:"800",color:f.ink,textAlign:"right",marginVertical:18},
 error:{color:"#ac3b4b",backgroundColor:"#fff0f0",padding:14,borderRadius:9,marginBottom:12},
 ...DUKKAN_THEME
});

type ActiveSession={token:string;stores:StoreInfo[];store:StoreInfo;user:{id:number;username:string}};
const SECURE_SESSION_KEY="caliskan_dukkan_account_v2";

export default function App(){
 const [account,setAccount]=useState<ActiveSession|null>(null);
 const [checking,setChecking]=useState(true);
 const [username,setUsername]=useState("");
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false);
 const [loginError,setLoginError]=useState("");
 const [logo,setLogo]=useState<string|null>(null);

 useEffect(()=>{
  let mounted=true;
  void (async()=>{
   try{
    const {uploadedLogoUrl}=await import("./remote-db");
    const url=await uploadedLogoUrl();
    if(mounted)setLogo(url);
   }catch{/* Logo absent or temporary network failure; native fallback remains */ }
  })();
  return ()=>{mounted=false;};
 },[]);
 useEffect(()=>{
  let mounted=true;
  void (async()=>{
   try {
    const stored=await SecureStore.getItemAsync(SECURE_SESSION_KEY);
    if(!stored)return;
    const previous=JSON.parse(stored) as ActiveSession;
    if(!previous?.token||!previous.user?.id)throw Error("Saklanan oturum geçersiz");
    const validStores=await availableStores(previous.token);
    const store=validStores.find(x=>x.id===previous.store?.id)||validStores[0];
    if(!store)throw Error("Hesabınıza atanmış mağaza bulunamadı");
    if(!mounted)return;
    setStoreSession(previous.token,store);
    setAccount({...previous,stores:validStores,store});
   }catch(e){
    if(mounted){clearStoreSession();setLoginError((e as Error).message);}
   }finally{if(mounted)setChecking(false);}
  })();
  return ()=>{mounted=false;};
 },[]);

 const enter=async()=>{
  if(busy)return;
  setBusy(true);setLoginError("");
  try{
   const result=await login(username,password);
   const store=result.stores[0];
   const next={token:result.token,stores:result.stores,store,user:result.user};
   await SecureStore.setItemAsync(SECURE_SESSION_KEY,JSON.stringify(next));
   setStoreSession(result.token,store);
   setAccount(next);setPassword("");
  }catch(e){setLoginError((e as Error).message);}
  finally{setBusy(false);}
 };
 const switchStore=(store:StoreInfo)=>{
  if(!account||!account.stores.some(s=>s.id===store.id))return;
  const next={...account,store};
  setStoreSession(account.token,store);setAccount(next);
  void SecureStore.setItemAsync(SECURE_SESSION_KEY,JSON.stringify(next));
 };
 const leave=()=>{
  clearStoreSession();setAccount(null);setPassword("");
  void SecureStore.deleteItemAsync(SECURE_SESSION_KEY).catch(()=>{});
 };
 if(checking)return <SafeAreaView style={{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#f4f6fa"}}>
  <ActivityIndicator size="large" color="#13283f"/><Text style={{color:"#13283f",marginTop:12}}>Hesap doğrulanıyor...</Text>
 </SafeAreaView>;
 if(account)return <StoreApp key={String(account.store.id)} session={account} onLogout={leave} onSwitch={switchStore}/>;
 return <SafeAreaView style={{flex:1,justifyContent:"center",padding:25,backgroundColor:"#f4f6fa"}}>
  <View style={{backgroundColor:"white",borderRadius:28,padding:26,borderWidth:1,borderColor:"#dfebfa",shadowColor:"#0b1e3c",shadowOpacity:0.12,shadowRadius:25,shadowOffset:{width:0,height:13},elevation:5}}>
   <View style={{alignItems:"center",marginBottom:24}}>
    {logo?<Image source={{uri:logo}} style={{width:100,height:100,borderRadius:20}} resizeMode="contain"/>:
      <View style={{width:86,height:86,borderRadius:18,backgroundColor:"#13283f",alignItems:"center",justifyContent:"center"}}><Text style={{color:"white",fontWeight:"900",fontSize:26}}>ÇD</Text></View>}
    <Text style={{fontSize:24,fontWeight:"900",color:"#13283f",marginTop:15}}>Çalışkan Dükkan</Text>
    <Text style={{fontSize:12,color:"#64748b",marginTop:4}}>Yetkili mağaza hesabınızla giriş yapın</Text>
   </View>
   <Text style={styles.label}>Kullanıcı adı / E-posta</Text>
   <TextInput style={[styles.input,{marginBottom:16}]} value={username} autoCapitalize="none" autoCorrect={false} autoComplete="username" onChangeText={setUsername} placeholder="Yönetici tarafından atanan kullanıcı"/>
   <Text style={styles.label}>Şifre</Text>
   <TextInput style={[styles.input,{marginBottom:18}]} value={password} secureTextEntry autoComplete="current-password" onChangeText={setPassword} placeholder="Şifreniz"/>
   {loginError?<Text style={styles.error}>{loginError}</Text>:null}
   <Pressable disabled={busy||!username.trim()||!password} onPress={()=>void enter()} style={[styles.primary,{marginRight:0,opacity:busy?0.5:1}]}>
    <Text style={styles.primaryText}>{busy?"Giriş yapılıyor...":"Giriş Yap"}</Text>
   </Pressable>
   <Text style={[styles.hint,{marginTop:16,textAlign:"center"}]}>Bu hesaba Çalışkan Admin panelinden mağaza yetkisi verilmiş olmalıdır.</Text>
  </View>
 </SafeAreaView>;
}
