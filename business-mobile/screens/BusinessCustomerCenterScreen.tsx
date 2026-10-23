import {useCallback,useEffect,useMemo,useState} from "react";
import {ActivityIndicator,Alert,RefreshControl,ScrollView,StyleSheet,Text,
  TouchableOpacity,View} from "react-native";
import {apiFetch} from "../lib/api";
import {
  changeApplication,formatDate,fullName,getCenter,getTimeline,moneyTR,statusName,
  type ActivityPage,type ActivityRecord,type B2BApplication,type CenterDetail,type CenterRecord,
} from "../lib/b2b-customer-center";
import {C} from "../ui/theme";
import {BackHeader,EmptyState} from "./common";

type Tab="profile"|"orders"|"invoices"|"returns"|"support"|"addresses"|"ledger"|"activity";
const sections:{key:Tab;label:string}[]=[
  {key:"profile",label:"Firma Bilgileri"},{key:"orders",label:"Siparişler"},
  {key:"invoices",label:"Faturalar"},{key:"returns",label:"İadeler"},
  {key:"support",label:"Destek"},{key:"addresses",label:"Adresler"},
  {key:"ledger",label:"Defter"},{key:"activity",label:"Tüm Hareketler"},
];
const tagStyle=(status:string)=>status==="approved"?
  {color:C.green,bg:C.greenSoft}:status==="rejected"?
  {color:C.red,bg:C.redSoft}:{color:C.orange,bg:C.orangeSoft};
const applyAmount=(v:CenterRecord,kind:Tab)=>kind==="ledger"
  ?moneyTR(Number(v.amount_cents||0)/100):moneyTR(v.total_amount);
function ProfileLine({label,value}:{label:string;value:string|number|boolean|null|undefined}){
  return <View style={s.profileLine}>
    <Text style={s.profileLabel}>{label}</Text>
    <Text style={s.profileValue}>{value===undefined||value===null||value===""?"—":String(value)}</Text>
  </View>;
}
function Stat({name,value,highlight=false}:{name:string;value:string|number;highlight?:boolean}){
  return <View style={s.stat}>
    <Text style={s.statName}>{name}</Text>
    <Text style={[s.statValue,highlight&&{color:C.green}]} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
  </View>;
}
export function BusinessCustomerCenterScreen({
  id,mode,onBack,onOpenCustomer
}:{id:string;mode:"application"|"customer";onBack:()=>void;onOpenCustomer?:(id:string)=>void;}){
  const [data,setData]=useState<CenterDetail|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [tab,setTab]=useState<Tab>("profile");
  const [page,setPage]=useState(1);
  const [timeline,setTimeline]=useState<ActivityPage|null>(null);
  const [loadingTimeline,setLoadingTimeline]=useState(false);
  const [timelineError,setTimelineError]=useState("");
  const load=useCallback(async()=>{
    setError("");
    try {setData(await getCenter(id));}
    catch(e){setError(e instanceof Error?e.message:"Firma bilgileri alınamadı.");}
    finally{setLoading(false);setRefreshing(false);}
  },[id]);
  useEffect(()=>{setTab("profile");setPage(1);setTimeline(null);setLoading(true);void load();},[load]);
  useEffect(()=>{
    if(tab!=="activity"||data?.customer.applicationStatus!=="approved")return;
    let active=true;
    setLoadingTimeline(true);setTimelineError("");
    getTimeline(id,page).then(result=>{if(active)setTimeline(result);}).catch((e)=>{
      if(active)setTimelineError(e instanceof Error?e.message:"Hareket geçmişi alınamadı.");
    }).finally(()=>{if(active)setLoadingTimeline(false);});
    return ()=>{active=false;};
  },[tab,page,id,data?.customer.applicationStatus]);

  const item=data?.customer;
  const approved=item?.applicationStatus==="approved";
  const tabs=useMemo(()=>approved?sections:sections.slice(0,1),[approved]);
  const doAction=useCallback((action:"approve"|"reject"|"resend-password")=>{
    const messages={
      approve:"Firmayı onaylayıp kayıtlı e-posta adresine tek kullanımlık şifre göndermek istiyor musunuz?",
      reject:"Başvuruyu reddetmek istediğinizden emin misiniz? Firma daha sonra tekrar başvurabilir.",
      "resend-password":"Henüz ilk şifresini belirlememiş müşteriye yeni geçici şifre e-postası gönderilsin mi?"
    };
    Alert.alert("İşlemi onayla",messages[action],[
      {text:"Vazgeç",style:"cancel"},
      {text:"Onayla",style:action==="reject"?"destructive":"default",onPress:async()=>{
        setBusy(true);
        try{
          const result=await changeApplication(id,action);
          await load();
          Alert.alert("İşlem başarılı",result.message||"Firma güncellendi.");
        }catch(e){Alert.alert("İşlem yapılamadı",e instanceof Error?e.message:"Tekrar deneyin.");}
        finally{setBusy(false);}
      }}
    ]);
  },[id,load]);
  const records=tab==="orders"?data?.orders:tab==="invoices"?data?.invoices:
    tab==="returns"?data?.returns:tab==="support"?data?.support:
    tab==="addresses"?data?.addresses:tab==="ledger"?data?.ledger:[];
  const recordLabel=(r:CenterRecord):string=>tab==="orders"?String(r.order_number||r.id):
    tab==="invoices"?String(r.invoice_number||r.order_number||r.id):
    tab==="returns"?String(r.order_number||"İade kaydı"):
    tab==="support"?String(r.subject||"Destek"):
    tab==="addresses"?String(r.title||"Adres"):
    tab==="ledger"?String(r.contact_name||"Defter"):String(r.id);
  const recordDetail=(r:CenterRecord):string=>tab==="orders"?
    `${r.item_count||0} ürün · ${r.payment_method||"Ödeme yöntemi belirtilmemiş"}`:
    tab==="returns"?String(r.reason||"İade talebi"):
    tab==="addresses"?[r.recipient,r.phone,r.city,r.district,r.address_line,r.postal_code].filter(Boolean).join(" · "):
    tab==="ledger"?[statusName(r.type),r.description].filter(Boolean).join(" · "):
    tab==="invoices"?String(r.order_number||"Sipariş numarası yok"):
    statusName(r.status);
  return <ScrollView style={s.page} keyboardShouldPersistTaps="handled"
    contentContainerStyle={s.content} refreshControl={<RefreshControl
      tintColor={C.text} refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>}>
    <BackHeader title={mode==="application"?"Başvuru Detayı":"Müşteri Dashboard"}
      subtitle="Firma bilgileri ve tüm B2B hareketleri" onBack={onBack}/>
    {loading?<ActivityIndicator color={C.blue} size="large" style={{marginTop:26}}/>:
    error||!item?<View style={s.errorBox}>
      <Text style={s.error}>{error||"Firma bulunamadı."}</Text>
      <TouchableOpacity style={s.action} onPress={()=>{setLoading(true);void load();}}>
        <Text style={s.actionText}>Yeniden dene</Text>
      </TouchableOpacity>
    </View>:<>
      <View style={s.hero}>
        <View style={s.heroTop}>
          <View style={s.avatar}><Text style={s.avatarText}>
            {(item.companyName||"F").slice(0,1).toUpperCase()}</Text></View>
          <View style={{flex:1}}>
            <Text style={s.company}>{item.companyName||"Firma adı belirtilmemiş"}</Text>
            <Text style={s.name}>{fullName(item)}</Text>
            <Text style={s.id}>Firma #{item.id}</Text>
          </View>
        </View>
        <View style={s.heroBottom}>
          <View style={[s.tag,{backgroundColor:tagStyle(item.applicationStatus||"pending").bg}]}>
            <Text style={{color:tagStyle(item.applicationStatus||"pending").color,fontSize:11,fontWeight:"700"}}>
              {statusName(item.applicationStatus)}</Text>
          </View>
          <Text style={{color:item.taxVerified?C.green:C.muted,fontSize:11}}>
            {item.taxVerified?"✓ Vergi doğrulandı":"Vergi doğrulanmadı"}
          </Text>
        </View>
      </View>
      {item.applicationStatus==="pending"?<View style={s.actions}>
        <TouchableOpacity style={[s.action,{backgroundColor:C.greenSoft,borderColor:C.green}]}
          disabled={busy} onPress={()=>doAction("approve")}>
          <Text style={[s.actionText,{color:C.green}]}>{busy?"İşleniyor…":"✓ Başvuruyu Onayla"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.action,{backgroundColor:C.redSoft,borderColor:C.red}]}
          disabled={busy} onPress={()=>doAction("reject")}>
          <Text style={[s.actionText,{color:C.red}]}>× Reddet</Text>
        </TouchableOpacity>
      </View>:null}
      {approved&&item.mustChangePassword?<TouchableOpacity style={s.resend}
        onPress={()=>doAction("resend-password")} disabled={busy}>
        <Text style={s.resendText}>✉  Tek Kullanımlık Şifreyi E-postayla Yenile</Text>
      </TouchableOpacity>:null}
      {approved&&mode==="application"&&onOpenCustomer?<TouchableOpacity
        style={s.openDashboard} onPress={()=>onOpenCustomer(id)}>
        <Text style={s.openDashboardText}>Müşteri Dashboard'unu Aç  ›</Text>
      </TouchableOpacity>:null}
      {approved&&data?.stats?<View style={s.metrics}>
        <Stat name="Sipariş sayısı" value={data.stats.orderCount}/>
        <Stat name="Toplam sipariş" value={moneyTR(data.stats.orderTotal)}/>
        <Stat name="Onaylı tahsilat" value={moneyTR(data.stats.paidTotal)} highlight/>
        <Stat name="Ödeme bekleyen" value={data.stats.awaitingPayment}/>
        <Stat name="Fatura" value={data.stats.invoiceCount}/>
        <Stat name="İade" value={data.stats.returnCount}/>
        <Stat name="Destek talebi" value={data.stats.openSupport}/>
        <Stat name="Defter hareketi" value={data.stats.ledgerEntryCount}/>
      </View>:null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabRail} style={{flexGrow:0}}>
        {tabs.map(t=><TouchableOpacity key={t.key}
          onPress={()=>{setTab(t.key);setPage(1);}}
          style={[s.tab,tab===t.key&&s.activeTab]}>
          <Text style={[s.tabText,tab===t.key&&s.activeTabText]}>{t.label}</Text>
        </TouchableOpacity>)}
      </ScrollView>
      {tab==="profile"?<>
        <Text style={s.heading}>Firma ve yetkili bilgileri</Text>
        <View style={s.profileCard}>
          <ProfileLine label="Firma adı" value={item.companyName}/>
          <ProfileLine label="Yetkili" value={fullName(item)}/>
          <ProfileLine label="E-posta adresi" value={item.email||item.username}/>
          <ProfileLine label="Kullanıcı adı" value={item.username}/>
          <ProfileLine label="Firma kategorisi" value={item.companyCategory}/>
          <ProfileLine label="Vergi numarası" value={item.taxNumber}/>
          <ProfileLine label="Vergi dairesi" value={item.taxOffice}/>
          <ProfileLine label="Vergi doğrulaması" value={item.taxVerified?"Doğrulandı":"Doğrulanmadı"}/>
          <ProfileLine label="Başvuru" value={statusName(item.applicationStatus)}/>
          <ProfileLine label="Başvuru tarihi" value={formatDate(item.createdAt)}/>
          <ProfileLine label="Onay tarihi" value={formatDate(item.approvedAt)}/>
          <ProfileLine label="Şifre e-posta gönderimi" value={formatDate(item.credentialsSentAt)}/>
          <ProfileLine label="Erişim" value={item.isActive?"Aktif":"Pasif"}/>
          <ProfileLine label="Yeni şifre zorunluluğu" value={item.mustChangePassword?"İlk şifre bekleniyor":"Şifre değişimi gerekmiyor"}/>
        </View>
        {!approved?<Text style={s.hint}>
          {item.applicationStatus==="rejected"?
            "Firma aynı e-posta ve vergi numarasıyla yeniden başvurabilir.":
            "Onaydan sonra kullanıcıya tek kullanımlık şifre e-posta ile gönderilir."}
        </Text>:null}
      </>:tab==="activity"?<>
        <View style={s.listHeading}><Text style={s.heading}>Tüm Hareketler</Text>
          <Text style={s.count}>{timeline?.total||0} kayıt</Text></View>
        {loadingTimeline?<ActivityIndicator color={C.blue} style={{marginVertical:25}}/>:
          timelineError?<Text style={s.error}>{timelineError}</Text>:
          !timeline?.rows.length?<EmptyState title="Hareket yok" text="Kayıtlı hareket bulunamadı."/>:
          <View style={s.recordList}>{timeline.rows.map(row=>
            <View key={row.type+row.id} style={s.record}>
              <View style={{flex:1}}>
                <Text style={s.recordTitle}>{row.title}</Text>
                <Text style={s.recordDetail}>{row.detail||"—"} · {statusName(row.status)}</Text>
                <Text style={s.recordDate}>{formatDate(row.happened_at)}</Text>
              </View>
              {row.amount!==null&&row.amount!==undefined?<Text style={s.recordMoney}>{moneyTR(row.amount)}</Text>:null}
            </View>)}</View>}
        <View style={s.pagination}>
          <TouchableOpacity style={[s.pageButton,page<=1&&s.disabled]}
            disabled={page<=1||loadingTimeline} onPress={()=>setPage(n=>Math.max(1,n-1))}>
            <Text style={s.pageText}>‹ Önceki</Text>
          </TouchableOpacity>
          <Text style={s.pageNumber}>Sayfa {page}</Text>
          <TouchableOpacity style={[s.pageButton,!timeline?.hasMore&&s.disabled]}
            disabled={!timeline?.hasMore||loadingTimeline} onPress={()=>setPage(n=>n+1)}>
            <Text style={s.pageText}>Sonraki ›</Text>
          </TouchableOpacity>
        </View>
      </>:<>
        <View style={s.listHeading}><Text style={s.heading}>
          {sections.find(x=>x.key===tab)?.label}</Text>
          <Text style={s.count}>{records?.length||0} kayıt gösteriliyor</Text>
        </View>
        {tab==="ledger"?<Text style={s.hint}>Defter, müşterinin özel bilgi kayıtlarıdır; resmî muhasebe bakiyesi değildir.</Text>:null}
        {!records?.length?<EmptyState title="Kayıt bulunamadı" text="Bu firmaya ait hareket yok."/>:
          <View style={s.recordList}>{records.map(row=><View key={row.id} style={s.record}>
            <View style={{flex:1,minWidth:0}}>
              <Text style={s.recordTitle}>{recordLabel(row)}</Text>
              <Text style={s.recordDetail}>{recordDetail(row)}</Text>
              <Text style={s.recordDate}>{formatDate(row.created_at)}</Text>
            </View>
            {(tab==="orders"||tab==="invoices"||tab==="ledger")?
              <Text style={s.recordMoney}>{applyAmount(row,tab)}</Text>:null}
          </View>)}</View>}
        {!!records?.length&&records.length>=100?<Text style={s.hint}>
          İlk 100 kayıt gösteriliyor; tüm kayıtlar Tüm Hareketler sekmesinden incelenebilir.
        </Text>:null}
      </>}
      {approved?<Text style={s.disclaimer}>
        Onaylı tahsilat yalnızca sistemde ödemesi doğrulanmış siparişleri gösterir. Başarısız ödeme girişimleri ciroya eklenmez.
      </Text>:null}
    </>}
  </ScrollView>;
}
const s=StyleSheet.create({
  page:{flex:1,backgroundColor:C.bg},content:{paddingHorizontal:18,paddingTop:10,paddingBottom:80},
  errorBox:{borderRadius:18,padding:15,backgroundColor:C.redSoft},
  error:{color:C.red,fontSize:12,lineHeight:19},
  hero:{backgroundColor:C.panel,borderColor:C.line,borderWidth:1,borderRadius:23,padding:18,marginBottom:14},
  heroTop:{flexDirection:"row",gap:12,alignItems:"center"},
  avatar:{width:56,height:56,borderRadius:17,backgroundColor:C.blueSoft,justifyContent:"center",alignItems:"center"},
  avatarText:{color:"#BDD4FF",fontSize:24,fontWeight:"800"},
  company:{color:C.text,fontSize:18,fontWeight:"800"},
  name:{color:C.text2,fontSize:12,marginTop:5},id:{color:C.muted,fontSize:10,marginTop:5},
  heroBottom:{borderTopWidth:1,borderColor:C.line,marginTop:15,paddingTop:12,
    flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  tag:{paddingHorizontal:10,paddingVertical:7,borderRadius:10},
  actions:{flexDirection:"row",gap:10,marginBottom:12},
  action:{flex:1,minHeight:48,backgroundColor:C.blueSoft,borderColor:C.blue,borderWidth:1,borderRadius:13,
    justifyContent:"center",alignItems:"center",paddingHorizontal:8,paddingVertical:8},
  actionText:{color:"#BDD4FF",fontSize:12,fontWeight:"700",textAlign:"center"},
  resend:{borderColor:C.line,borderWidth:1,borderRadius:14,minHeight:50,
    justifyContent:"center",alignItems:"center",paddingHorizontal:10,marginBottom:12},
  resendText:{color:C.text,fontSize:12,fontWeight:"700"},
  openDashboard:{borderRadius:14,backgroundColor:C.blueSoft,borderWidth:1,borderColor:C.blue,
    minHeight:52,justifyContent:"center",alignItems:"center",marginBottom:12},
  openDashboardText:{color:"#BDD4FF",fontWeight:"800",fontSize:13},
  metrics:{flexDirection:"row",flexWrap:"wrap",gap:9,marginBottom:19},
  stat:{width:"48.5%",minHeight:95,borderWidth:1,borderColor:C.line,
    backgroundColor:C.panel,borderRadius:17,padding:13},
  statName:{color:C.muted,fontSize:11},statValue:{color:C.text,fontSize:20,fontWeight:"800",marginTop:13},
  tabRail:{gap:8,paddingBottom:16},
  tab:{minHeight:39,paddingHorizontal:14,justifyContent:"center",borderRadius:11,
    backgroundColor:C.panel,borderColor:C.line,borderWidth:1},
  activeTab:{backgroundColor:C.blueSoft,borderColor:C.blue},
  tabText:{color:C.text2,fontSize:12},activeTabText:{color:C.text,fontWeight:"700"},
  heading:{color:C.text,fontWeight:"700",fontSize:18,marginBottom:10},
  profileCard:{borderRadius:19,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,
    paddingHorizontal:15,paddingVertical:5},
  profileLine:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line,
    paddingVertical:12,flexDirection:"row",gap:12},
  profileLabel:{color:C.muted,fontSize:11,width:"39%"},
  profileValue:{color:C.text,fontSize:12,fontWeight:"600",flex:1,textAlign:"right",lineHeight:18},
  hint:{color:C.muted,fontSize:11,lineHeight:18,marginTop:12,marginBottom:14},
  listHeading:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:8},
  count:{color:C.muted,fontSize:11},
  recordList:{borderRadius:18,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,
    overflow:"hidden"},
  record:{flexDirection:"row",alignItems:"center",gap:8,borderBottomWidth:StyleSheet.hairlineWidth,
    borderBottomColor:C.line,padding:14},
  recordTitle:{color:C.text,fontSize:13,fontWeight:"700"},
  recordDetail:{color:C.text2,fontSize:11,marginTop:5,lineHeight:17},
  recordDate:{color:C.muted,fontSize:10,marginTop:5},
  recordMoney:{color:C.text,fontSize:12,fontWeight:"700"},
  pagination:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:14},
  pageButton:{minHeight:41,paddingHorizontal:14,borderWidth:1,borderColor:C.line,borderRadius:12,
    justifyContent:"center"},pageText:{color:C.text,fontWeight:"700",fontSize:12},
  pageNumber:{color:C.muted,fontSize:11},disabled:{opacity:0.35},
  disclaimer:{color:C.muted,fontSize:10,lineHeight:17,marginTop:23}
});
