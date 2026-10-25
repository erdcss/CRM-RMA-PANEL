import React,{useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Alert,KeyboardAvoidingView,Platform,Pressable,SafeAreaView,ScrollView,StatusBar,StyleSheet,Text,TextInput,View} from "react-native";
import {StatusBar as ExpoStatusBar} from "expo-status-bar";
import {add,getDb,list,report,settings,setStatus,summary,today,type Collection,type Form,type Line,type RecordRow} from "./local-db";
import {exportBackup,importBackup} from "./portable-backup";

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
const f={white:"#ffffff",bg:"#f4f6fa",ink:"#13283f",muted:"#8392a8",amber:"#efba63",border:"#e4eaf1",green:"#137f65"};
const FIELDS:Record<string,Field[]>={
 party:[{key:"name",label:"Cari adı",required:true},{key:"kind",label:"Cari türü",kind:"choice",options:["customer","supplier","both"]},{key:"tax",label:"Vergi / TC no"},{key:"phone",label:"Telefon"},{key:"email",label:"E-posta"},{key:"address",label:"Adres"}],
 product:[{key:"code",label:"Stok kodu",required:true},{key:"barcode",label:"Barkod"},{key:"name",label:"Ürün adı",required:true},{key:"unit",label:"Birim",kind:"choice",options:["Adet","Koli","Paket","Kg","Metre"]},{key:"purchase",label:"Alış fiyatı (TL)",kind:"number",required:true},{key:"sale",label:"Satış fiyatı (TL)",kind:"number",required:true}],
 invoice:[{key:"kind",label:"Fatura türü",kind:"choice",options:["sale","purchase","sale_return","purchase_return"]},{key:"number",label:"Fatura numarası",required:true},{key:"date",label:"Tarih (YYYY-AA-GG)",required:true},{key:"partyId",label:"Cari hesap",kind:"party",required:true},{key:"notes",label:"Açıklama"}],
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
export default function App(){
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
 const reload=useCallback(async()=>{
  try{
   await getDb();
   const [p,pr,b,s,sets]=await Promise.all([list("parties"),list("products"),list("banks"),summary(),settings()]);
   setParties(p);setProducts(pr);setBanks(b);setSums(s);setExistingSettings(sets);setCompany(sets.company||"İşletmem");
   if(tab==="report")setMonthly((await report()).monthly);
   else if(tab==="dashboard")setRecords((await list("invoices")).slice(0,10));
   else if(tab==="settings")setRecords([]);
   else setRecords(await list(tab as Collection));
   setError("");
  }catch(e){setError((e as Error).message);}finally{setReady(true);}
 },[tab,refresh]);
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
   await add(formType,payload);
   setFormType(null);setRefresh(x=>x+1);
   Alert.alert("Başarılı","Kayıt yerel veritabanına işlendi.");
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
 const doExport=async()=>{try{setBusy(true);await exportBackup();}catch(e){Alert.alert("Yedek alınamadı",(e as Error).message);}finally{setBusy(false);}};
 const doImport=async()=>{
  Alert.alert("Yedekten geri yükle","Mevcut tüm kayıtlar seçtiğiniz Windows/Çalışkan Dükkan yedeğiyle değiştirilecek. Önce yedek alınız.",[
   {text:"Vazgeç",style:"cancel"},
   {text:"Dosya Seç",style:"destructive",onPress:async()=>{
    try{setBusy(true);const ok=await importBackup();if(ok){setRefresh(n=>n+1);Alert.alert("Başarılı","Veritabanı yedeği geri yüklendi.");}}
    catch(e){Alert.alert("İçe aktarım başarısız",(e as Error).message);}
    finally{setBusy(false);}
   }}
  ]);
 };
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
  <View style={styles.header}><View><Text style={styles.overline}>ÇALIŞKAN DÜKKAN · MOBİL</Text><Text style={styles.brand}>{company}</Text><Text style={styles.headerSub}>Bağımsız Ön Muhasebe 1.0</Text></View><View style={styles.offline}><Text style={{color:"#89f0c8",fontSize:11,fontWeight:"800"}}>● ÇEVRİMDIŞI</Text></View></View>
  <ScrollView horizontal style={styles.nav} contentContainerStyle={styles.navInner} showsHorizontalScrollIndicator={false}>
   {TABS.map(t=><Pressable key={t.key} style={[styles.tab,tab===t.key?styles.selectedTab:null]} onPress={()=>{setTab(t.key);setFilter("");setFormType(null);}}><Text style={[styles.tabText,tab===t.key?{color:"white"}:null]}>{t.title}</Text></Pressable>)}
  </ScrollView>
  <ScrollView key={tab} style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled">
   <View style={styles.pageHead}><Text style={styles.pageTitle}>{TABS.find(x=>x.key===tab)?.title}</Text><Text style={styles.pageNote}>{tab==="dashboard"?"İşletmenizin anlık görünümü":tab==="settings"?"Bilgiler bu telefonda saklanır":"Yerel kayıtlarınız"}</Text></View>
   {error!==""&&<Text style={styles.error}>{error}</Text>}
   {!ready?<ActivityIndicator color={f.ink} size="large"/>:null}
   {tab==="dashboard"&&<View style={styles.cards}>
     {([["Net Satış",sums.sales],["Net Alış",sums.purchases],["Alacaklar",sums.receivables],["Borçlar",sums.payables],["Kasa",sums.cash],["Banka",sums.bank],["Stok Değeri",sums.stockCost]] as [string,number][]).map(([name,value])=>
      <View key={name} style={styles.stat}><Text style={styles.statName}>{name}</Text><Text style={styles.statValue}>{money(value)}</Text></View>)}
     <View style={styles.stat}><Text style={styles.statName}>Ürün Sayısı</Text><Text style={styles.statValue}>{sums.products||0}</Text></View>
    </View>}
   {tab==="report"&&<View><View style={styles.cards}><View style={styles.stat}><Text style={styles.statName}>Faturalar</Text><Text style={styles.statValue}>{sums.documents||0}</Text></View><View style={styles.stat}><Text style={styles.statName}>Geciken Çek / Senet</Text><Text style={styles.statValue}>{sums.overdue||0}</Text></View></View>
     <Text style={styles.groupTitle}>Aylık alış / satış</Text>{monthly.map(r=><View style={styles.row} key={String(r.month)}><Text style={styles.rowTitle}>{r.month}</Text><Text style={styles.rowNote}>Satış {money(r.sales)}   ·   Alış {money(r.purchases)}</Text></View>)}</View>}
   {tab==="settings"&&<View><View style={styles.card}><Text style={styles.groupTitle}>Veriler ve Güvenlik</Text><Text style={styles.hint}>Bu uygulama Çalışkan Admin web sayfası değildir; kendi SQLite veritabanını kullanır. Windows sürümünden aldığınız SQLite yedeğini buraya aktarabilirsiniz. Bu işlem canlı eşitleme değil, dosya aktarımıdır.</Text>
    <Pressable disabled={busy} style={[styles.primary,{marginVertical:8}]} onPress={doExport}><Text style={styles.primaryText}>SQLite Yedeğini Paylaş</Text></Pressable>
    <Pressable disabled={busy} style={[styles.secondary,{marginVertical:8}]} onPress={doImport}><Text style={styles.secondaryText}>Windows / Mobil Yedeği İçe Aktar</Text></Pressable>
    <Text style={styles.hint}>Önemli: Yedek aktarımı mevcut verileri tamamen değiştirir. Önce mevcut verilerinizi yedekleyin.</Text></View>
    <View style={styles.card}><Text style={styles.groupTitle}>Dahili Muhasebe Uyarısı</Text><Text style={styles.hint}>e-Fatura/e-Arşiv oluşturma ve GİB'e gönderim yoktur. Resmî muhasebe belgesi olarak kullanmayın.</Text></View></View>}
   {ACTIONS[tab].length>0&&<ScrollView horizontal style={{flexGrow:0,marginBottom:17}} showsHorizontalScrollIndicator={false}>
    {ACTIONS[tab].map(x=><Pressable key={x.kind} onPress={()=>open(x.kind)} style={styles.primary}><Text style={styles.primaryText}>＋ {x.label}</Text></Pressable>)}
   </ScrollView>}
   {!["settings","report"].includes(tab)&&<View>
    {tab!=="dashboard"&&<TextInput placeholder="Kayıtlarda ara..." placeholderTextColor={f.muted} value={filter} onChangeText={setFilter} style={[styles.input,{marginBottom:14}]}/>}
    <Text style={styles.groupTitle}>{tab==="dashboard"?"Son Faturalar":"Kayıt Listesi"} ({shown.length})</Text>
    {shown.length===0?<View style={styles.empty}><Text style={styles.emptyTitle}>Henüz kayıt yok</Text><Text style={styles.hint}>Yeni bir kayıt oluşturarak başlayabilirsiniz.</Text></View>:shown.slice(0,250).map((r,i)=><Pressable onPress={()=>{"status" in r&&["instruments","orders"].includes(tab)&&String(r.status)===(tab==="orders"?"open":"pending")?statusAction(tab==="orders"?"order":"instrument",r):null;}}
      key={String(r.id||i)} style={styles.row}><View style={{flex:1}}><Text numberOfLines={2} style={styles.rowTitle}>{rowTitle(r)}</Text><Text numberOfLines={2} style={styles.rowNote}>{rowSubtitle(r)}</Text></View><View style={{alignItems:"flex-end",maxWidth:130}}><Text style={styles.rowAmount}>{rowAmount(r)}</Text>{r.status&&<Text style={styles.badge}>{val(r.status)}</Text>}</View></Pressable>)}
    {shown.length>250&&<Text style={styles.hint}>İlk 250 kayıt gösteriliyor. Arama ile filtreleyin.</Text>}
   </View>}
  </ScrollView>
  {formType&&<KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={styles.overlay}>
   <View style={styles.modal}><View style={styles.modalHead}><Text style={styles.modalTitle}>{ACTIONS[tab].find(a=>a.kind===formType)?.label||"Yeni İşlem"}</Text><Pressable onPress={()=>setFormType(null)}><Text style={{fontSize:22,color:f.ink}}>×</Text></Pressable></View>
    <ScrollView contentContainerStyle={{padding:20,paddingBottom:35}} keyboardShouldPersistTaps="always">
     {(FIELDS[formType]||[]).filter(field=>!(formType==="payment"&&field.key==="bankId"&&data.method!=="bank")).map(fieldView)}
     {["invoice","order"].includes(formType)&&<View>
       <Text style={styles.groupTitle}>Ürün Kalemleri</Text>
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
 tabText:{fontSize:12,fontWeight:"700",color:f.ink},content:{flex:1},contentInner:{padding:18,paddingBottom:85},pageHead:{marginBottom:19},pageTitle:{fontSize:23,fontWeight:"850",color:f.ink},pageNote:{fontSize:12,color:f.muted,marginTop:5},
 cards:{flexDirection:"row",flexWrap:"wrap",gap:10,marginBottom:18},stat:{backgroundColor:"white",borderRadius:14,padding:15,borderWidth:1,borderColor:f.border,width:"48%",minWidth:145},statName:{color:f.muted,fontSize:11,fontWeight:"600"},statValue:{color:f.ink,fontSize:18,fontWeight:"800",marginTop:13},
 groupTitle:{fontSize:16,color:f.ink,fontWeight:"800",marginBottom:12},primary:{backgroundColor:f.ink,borderRadius:12,paddingHorizontal:17,paddingVertical:13,marginRight:9,alignItems:"center",justifyContent:"center"},primaryText:{color:"white",fontWeight:"800",fontSize:13},
 secondary:{backgroundColor:"#eef2f8",borderRadius:12,padding:14,alignItems:"center",borderWidth:1,borderColor:f.border},secondaryText:{fontWeight:"800",fontSize:13,color:f.ink},
 card:{backgroundColor:"white",borderRadius:15,borderWidth:1,borderColor:f.border,padding:18,marginBottom:15},row:{backgroundColor:"white",borderWidth:1,borderColor:f.border,borderRadius:14,padding:16,marginBottom:9,flexDirection:"row",alignItems:"center",gap:14},
 rowTitle:{fontSize:14,fontWeight:"800",color:f.ink},rowNote:{fontSize:11,color:f.muted,marginTop:6},rowAmount:{fontSize:14,fontWeight:"800",color:f.ink},badge:{fontSize:10,color:f.green,marginTop:5,fontWeight:"800"},
 hint:{fontSize:12,color:f.muted,lineHeight:19},empty:{backgroundColor:"white",borderWidth:1,borderColor:f.border,borderRadius:14,padding:25,alignItems:"center",gap:8},emptyTitle:{color:f.ink,fontWeight:"700"},
 overlay:{position:"absolute",top:0,bottom:0,left:0,right:0,backgroundColor:"#0a1c33ab",justifyContent:"flex-end"},modal:{backgroundColor:"white",borderTopLeftRadius:25,borderTopRightRadius:25,maxHeight:"94%",minHeight:"50%"},
 modalHead:{padding:19,paddingHorizontal:21,borderBottomWidth:1,borderColor:f.border,flexDirection:"row",justifyContent:"space-between"},modalTitle:{fontSize:18,color:f.ink,fontWeight:"850"},
 field:{marginBottom:17},label:{fontSize:12,color:"#475971",fontWeight:"800",marginBottom:7},input:{backgroundColor:"white",borderWidth:1,borderColor:"#d6dee9",borderRadius:11,paddingHorizontal:12,paddingVertical:10,fontSize:14,color:f.ink,minHeight:45},
 chip:{borderRadius:11,backgroundColor:"#eef2f6",paddingHorizontal:14,paddingVertical:11,marginRight:8,marginBottom:5},chipActive:{backgroundColor:f.ink},
 line:{padding:14,backgroundColor:"#f5f8fb",borderWidth:1,borderColor:f.border,borderRadius:12,marginBottom:13},lineInputRow:{flexDirection:"row",gap:9,marginTop:12},smallLabel:{fontSize:10,color:f.muted,marginBottom:6},total:{fontSize:15,fontWeight:"800",color:f.ink,textAlign:"right",marginVertical:18},
 error:{color:"#ac3b4b",backgroundColor:"#fff0f0",padding:14,borderRadius:9,marginBottom:12}
});
