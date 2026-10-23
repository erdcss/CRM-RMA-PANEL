import {useCallback,useEffect,useMemo,useState} from "react";
import {
  ActivityIndicator,RefreshControl,ScrollView,StyleSheet,Text,TextInput,
  TouchableOpacity,View
} from "react-native";
import {getApplications,fullName,formatDate,statusName,type B2BApplication}
  from "../lib/b2b-customer-center";
import {C} from "../ui/theme";
import {BackHeader,EmptyState} from "./common";

type Filter="pending"|"rejected"|"all";
const tabs:{id:Filter;label:string}[]=[
  {id:"pending",label:"Bekleyenler"},{id:"rejected",label:"Reddedilenler"},
  {id:"all",label:"Tümü"}
];
function StatusTag({status}:{status?:string|null}){
  const approved=status==="approved",rejected=status==="rejected";
  const color=approved?C.green:rejected?C.red:C.orange;
  const bg=approved?C.greenSoft:rejected?C.redSoft:C.orangeSoft;
  return <View style={[s.tag,{backgroundColor:bg}]}>
    <Text style={[s.tagText,{color}]}>{statusName(status)}</Text>
  </View>;
}
export function BusinessApplicationsScreen({
  onBack,onOpenApplication,onOpenCustomer
}:{
  onBack:()=>void;onOpenApplication:(id:string)=>void;onOpenCustomer:()=>void;
}){
  const [items,setItems]=useState<B2BApplication[]>([]);
  const [filter,setFilter]=useState<Filter>("pending");
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");
  const load=useCallback(async()=>{
    setError("");
    try{
      const list=await getApplications();
      setItems(Array.isArray(list)?list:[]);
    }catch(e){setError(e instanceof Error?e.message:"Başvurular alınamadı.");}
    finally{setLoading(false);setRefreshing(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const stats=useMemo(()=>({
    pending:items.filter(x=>x.applicationStatus==="pending").length,
    approved:items.filter(x=>x.applicationStatus==="approved").length,
    rejected:items.filter(x=>x.applicationStatus==="rejected").length,
  }),[items]);
  const filtered=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase("tr-TR");
    return items.filter(x=>{
      if(filter!=="all"&&x.applicationStatus!==filter)return false;
      if(!needle)return true;
      return [
        x.companyName,fullName(x),x.email,x.username,x.taxNumber,x.taxOffice,x.companyCategory
      ].some(text=>String(text||"").toLocaleLowerCase("tr-TR").includes(needle));
    });
  },[items,filter,query]);
  return <ScrollView style={s.page} contentContainerStyle={s.content}
    keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl tintColor={C.text} refreshing={refreshing}
      onRefresh={()=>{setRefreshing(true);void load();}}/>}>
    <BackHeader title="Başvurular" subtitle="B2B firma başvuru ve onay yönetimi" onBack={onBack}/>
    <View style={s.stats}>
      <Summary title="Bekleyen" value={stats.pending} color={C.orange}/>
      <Summary title="Onaylanan" value={stats.approved} color={C.green}/>
      <Summary title="Reddedilen" value={stats.rejected} color={C.red}/>
    </View>

    <TouchableOpacity onPress={onOpenCustomer} style={s.customerLink} activeOpacity={0.8}>
      <View style={s.customerIcon}><Text style={s.customerIconText}>▦</Text></View>
      <View style={{flex:1}}>
        <Text style={s.customerLinkTitle}>B2B Müşteriler</Text>
        <Text style={s.customerLinkDesc}>Onaylanan {stats.approved} firma · Müşteri dashboardları</Text>
      </View><Text style={s.arrow}>›</Text>
    </TouchableOpacity>

    <View style={s.searchRow}>
      <Text style={s.searchGlyph}>⌕</Text>
      <TextInput style={s.search} placeholder="Firma, yetkili, e-posta veya vergi no ara"
        placeholderTextColor={C.muted} value={query} onChangeText={setQuery}
        autoCapitalize="none" autoCorrect={false}/>
      {!!query&&<TouchableOpacity onPress={()=>setQuery("")}><Text style={s.clear}>×</Text></TouchableOpacity>}
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.tabs}>
      {tabs.map(t=><TouchableOpacity key={t.id} activeOpacity={0.78}
        onPress={()=>setFilter(t.id)} style={[s.chip,filter===t.id&&s.chipActive]}>
        <Text style={[s.chipText,filter===t.id&&s.chipTextActive]}>
          {t.label} {t.id==="pending"?stats.pending:t.id==="rejected"?stats.rejected:items.length}
        </Text>
      </TouchableOpacity>)}
    </ScrollView>
    <View style={s.listHeading}>
      <Text style={s.heading}>Firma başvuruları</Text>
      <Text style={s.count}>{filtered.length} kayıt</Text>
    </View>
    {!!error&&<View style={s.errorBox}><Text style={s.error}>{error}</Text>
      <TouchableOpacity onPress={()=>{setLoading(true);void load();}}><Text style={s.retry}>Tekrar dene</Text></TouchableOpacity>
    </View>}
    {loading?<ActivityIndicator size="large" color={C.blue} style={{marginTop:35}}/>
      :!error&&filtered.length===0?<EmptyState title="Başvuru bulunamadı"
        text="Arama veya seçilen duruma uygun firma başvurusu yok."/>
      :<View style={s.list}>
        {filtered.map(item=>{
          const initial=(item.companyName||"F").slice(0,1).toLocaleUpperCase("tr-TR");
          return <TouchableOpacity key={item.id} style={s.card}
            onPress={()=>onOpenApplication(String(item.id))} activeOpacity={0.75}>
            <View style={s.top}>
              <View style={s.avatar}><Text style={s.initial}>{initial}</Text></View>
              <View style={{flex:1,minWidth:0}}>
                <Text style={s.company} numberOfLines={2}>{item.companyName||"Firma adı belirtilmemiş"}</Text>
                <Text style={s.person} numberOfLines={1}>{fullName(item)}</Text>
              </View>
              <StatusTag status={item.applicationStatus}/>
            </View>
            <View style={s.line}/>
            <Text style={s.detail} numberOfLines={1}>✉  {item.email||item.username}</Text>
            <Text style={s.detail} numberOfLines={2}>⌁  {item.companyCategory||"Kategori belirtilmemiş"} · VKN: {item.taxNumber||"—"}</Text>
            <View style={s.foot}>
              <Text style={s.date}>{formatDate(item.createdAt)}</Text>
              <Text style={s.view}>Detayları İncele  ›</Text>
            </View>
          </TouchableOpacity>;
        })}
      </View>}
  </ScrollView>;
}
function Summary({title,value,color}:{title:string;value:number;color:string}){
  return <View style={s.stat}>
    <Text style={s.statTitle} numberOfLines={1}>{title}</Text>
    <Text style={[s.statValue,{color}]}>{value}</Text>
  </View>;
}
const s=StyleSheet.create({
  page:{flex:1,backgroundColor:C.bg},content:{paddingHorizontal:18,paddingTop:10,paddingBottom:55},
  stats:{flexDirection:"row",gap:8,marginBottom:16},
  stat:{flex:1,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,
    borderRadius:18,padding:11,minHeight:84},
  statTitle:{color:C.muted,fontSize:11},statValue:{fontSize:28,fontWeight:"800",marginTop:10},
  customerLink:{flexDirection:"row",alignItems:"center",gap:11,borderRadius:18,
    borderWidth:1,borderColor:"rgba(59,130,246,0.35)",backgroundColor:C.blueSoft,
    padding:15,marginBottom:16},
  customerIcon:{width:38,height:38,borderRadius:12,backgroundColor:"rgba(59,130,246,0.28)",
    alignItems:"center",justifyContent:"center"},
  customerIconText:{color:"#BAD5FF",fontSize:23},
  customerLinkTitle:{color:C.text,fontWeight:"800",fontSize:14},
  customerLinkDesc:{color:C.text2,fontSize:11,marginTop:4},
  arrow:{color:C.text2,fontSize:27},searchRow:{flexDirection:"row",alignItems:"center",
    borderWidth:1,borderColor:C.line,borderRadius:16,backgroundColor:C.panel,paddingHorizontal:14,minHeight:53},
  searchGlyph:{fontSize:24,color:C.text2,marginRight:8},
  search:{flex:1,color:C.text,fontSize:13,paddingVertical:9},
  clear:{color:C.muted,fontSize:22,paddingHorizontal:6},
  tabs:{gap:8,paddingVertical:15},
  chip:{minHeight:39,justifyContent:"center",paddingHorizontal:14,
    borderWidth:1,borderColor:C.line,borderRadius:12,backgroundColor:C.panel},
  chipActive:{borderColor:C.blue,backgroundColor:C.blueSoft},
  chipText:{color:C.text2,fontSize:11},chipTextActive:{color:C.text,fontWeight:"700"},
  listHeading:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:12},
  heading:{color:C.text,fontSize:17,fontWeight:"700"},count:{color:C.muted,fontSize:12},
  errorBox:{padding:13,backgroundColor:C.redSoft,borderRadius:12,marginBottom:13},
  error:{color:C.red,fontSize:12,lineHeight:18},retry:{color:C.text,fontWeight:"700",marginTop:10},
  list:{gap:12},card:{borderRadius:21,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,padding:15},
  top:{flexDirection:"row",alignItems:"center",gap:12},avatar:{width:46,height:46,borderRadius:14,
    backgroundColor:C.blueSoft,alignItems:"center",justifyContent:"center"},
  initial:{color:"#9FC0FF",fontSize:19,fontWeight:"700"},
  company:{color:C.text,fontSize:15,fontWeight:"700"},person:{color:C.muted,fontSize:11,marginTop:4},
  tag:{borderRadius:9,paddingVertical:6,paddingHorizontal:8,alignSelf:"flex-start"},
  tagText:{fontSize:9,fontWeight:"700"},
  line:{borderTopWidth:1,borderColor:C.line,marginVertical:13},
  detail:{color:C.text2,fontSize:12,lineHeight:20,marginBottom:5},
  foot:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:8},
  date:{color:C.muted,fontSize:10},view:{color:"#9FC0FF",fontSize:11,fontWeight:"700"}
});
