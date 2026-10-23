import {useCallback,useEffect,useMemo,useState} from "react";
import {ActivityIndicator,RefreshControl,ScrollView,StyleSheet,Text,TextInput,
  TouchableOpacity,View} from "react-native";
import {C} from "../ui/theme";
import {EmptyState,MiniStat,PageHeader} from "./common";
import {getApprovedApplications,fullName,formatDate,type B2BApplication}
  from "../lib/b2b-customer-center";

export function CustomersScreen({onOpenCustomer}:{onOpenCustomer:(id:string)=>void}){
  const [items,setItems]=useState<B2BApplication[]>([]);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<"Tümü"|"Şifre Bekleyen"|"Aktif">("Tümü");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const load=useCallback(async()=>{
    setError("");
    try{
      const customers=await getApprovedApplications();
      setItems(customers);
    }catch(e){setError(e instanceof Error?e.message:"Müşteriler alınamadı.");}
    finally{setLoading(false);setRefreshing(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const pending=items.filter(x=>x.mustChangePassword).length;
  const verified=items.filter(x=>x.taxVerified).length;
  const list=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase("tr-TR");
    return items.filter(x=>{
      if(filter==="Şifre Bekleyen"&&!x.mustChangePassword)return false;
      if(filter==="Aktif"&&x.mustChangePassword)return false;
      return !needle||[x.companyName,fullName(x),x.email,x.taxNumber,x.companyCategory]
        .some(x=>String(x||"").toLocaleLowerCase("tr-TR").includes(needle));
    });
  },[items,query,filter]);
  return <ScrollView style={s.page} contentContainerStyle={s.content}
    keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl tintColor={C.text} refreshing={refreshing}
      onRefresh={()=>{setRefreshing(true);void load();}}/>}>
    <PageHeader title="B2B Müşteriler" subtitle="Onaylı firmalar, hesaplar ve ticari hareketler"/>
    <View style={s.stats}>
      <MiniStat icon="◎" title="Onaylı" value={items.length}/>
      <MiniStat icon="✓" title="Vergi doğrulanmış" value={verified} accent={C.green}/>
      <MiniStat icon="◷" title="Şifre bekleyen" value={pending} accent={C.orange}/>
    </View>
    <View style={s.searchRow}>
      <Text style={s.searchIcon}>⌕</Text>
      <TextInput placeholder="Firma, e-posta, vergi numarası ara…" placeholderTextColor={C.muted}
        style={s.search} value={query} onChangeText={setQuery} autoCapitalize="none"
        autoCorrect={false}/>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={{flexGrow:0}} contentContainerStyle={s.filters}>
      {(["Tümü","Aktif","Şifre Bekleyen"] as const).map(name=>
        <TouchableOpacity key={name} style={[s.filter,filter===name&&s.activeFilter]}
          onPress={()=>setFilter(name)}>
          <Text style={[s.filterText,filter===name&&s.activeFilterText]}>{name}</Text>
        </TouchableOpacity>)}
    </ScrollView>
    <Text style={s.count}>{list.length} firma gösteriliyor</Text>
    {!!error&&<TouchableOpacity style={s.errorBox} onPress={()=>{setLoading(true);void load();}}>
      <Text style={s.error}>{error} · Tekrar dene</Text>
    </TouchableOpacity>}
    {loading?<ActivityIndicator style={{marginTop:28}} size="large" color={C.blue}/>:
    !error&&list.length===0?<EmptyState title="Firma bulunamadı"
      text="Onaylanan firmalar otomatik olarak bu listede görünür."/>:
    <View style={s.list}>{list.map(item=>
      <TouchableOpacity key={item.id} style={s.card} activeOpacity={0.75}
        onPress={()=>onOpenCustomer(String(item.id))}>
        <View style={s.top}>
          <View style={s.avatar}><Text style={s.avatarText}>
            {(item.companyName||"F").slice(0,1).toLocaleUpperCase("tr-TR")}
          </Text></View>
          <View style={s.main}>
            <Text style={s.company}>{item.companyName||"Firma"}</Text>
            <Text style={s.contact}>{fullName(item)}</Text>
            <Text style={s.email} numberOfLines={1}>{item.email||item.username}</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </View>
        <View style={s.footer}>
          <View style={{flex:1}}>
            <Text style={s.meta}>VKN: {item.taxNumber||"—"} · {item.companyCategory||"Kategori belirtilmedi"}</Text>
            <Text style={s.date}>Onay tarihi: {formatDate(item.approvedAt)}</Text>
          </View>
          <View style={[s.tag,{backgroundColor:item.mustChangePassword?C.orangeSoft:C.greenSoft}]}>
            <Text style={{color:item.mustChangePassword?C.orange:C.green,fontSize:10,fontWeight:"700"}}>
              {item.mustChangePassword?"Şifre bekliyor":"Aktif"}
            </Text>
          </View>
        </View>
        <View style={s.bottom}><Text style={s.bottomText}>Firma Dashboard'u ve Tüm Hareketler  ›</Text></View>
      </TouchableOpacity>)}</View>}
  </ScrollView>;
}
const s=StyleSheet.create({
  page:{flex:1,backgroundColor:C.bg},
  content:{paddingHorizontal:18,paddingTop:12,paddingBottom:118},
  stats:{flexDirection:"row",gap:8,marginBottom:17},
  searchRow:{flexDirection:"row",alignItems:"center",minHeight:53,
    backgroundColor:C.panel,borderRadius:16,borderWidth:1,borderColor:C.line,paddingHorizontal:13},
  searchIcon:{color:C.text2,fontSize:25,marginRight:10},
  search:{flex:1,color:C.text,fontSize:13,paddingVertical:10},
  filters:{gap:8,paddingVertical:15},
  filter:{minHeight:39,justifyContent:"center",borderRadius:12,borderWidth:1,
    borderColor:C.line,backgroundColor:C.panel,paddingHorizontal:13},
  activeFilter:{borderColor:C.blue,backgroundColor:C.blueSoft},
  filterText:{color:C.text2,fontSize:12},activeFilterText:{color:C.text,fontWeight:"700"},
  count:{color:C.muted,fontSize:12,marginBottom:13},
  errorBox:{borderRadius:14,padding:14,backgroundColor:C.redSoft,marginBottom:12},
  error:{color:C.red,fontSize:12},list:{gap:12},
  card:{borderRadius:21,borderColor:C.line,borderWidth:1,backgroundColor:C.panel,overflow:"hidden"},
  top:{flexDirection:"row",alignItems:"center",gap:12,padding:14},
  avatar:{width:50,height:50,borderRadius:15,backgroundColor:C.blueSoft,
    justifyContent:"center",alignItems:"center"},
  avatarText:{fontSize:20,fontWeight:"800",color:"#AAC8FF"},
  main:{flex:1,minWidth:0},company:{fontSize:15,fontWeight:"800",color:C.text},
  contact:{color:C.text2,fontSize:11,marginTop:4},
  email:{color:C.muted,fontSize:10,marginTop:4},
  chevron:{fontSize:26,color:C.text2},
  footer:{paddingHorizontal:14,paddingBottom:14,flexDirection:"row",alignItems:"center",gap:6},
  meta:{color:C.text2,fontSize:11},date:{color:C.muted,fontSize:10,marginTop:6},
  tag:{borderRadius:10,paddingHorizontal:8,paddingVertical:7},
  bottom:{borderTopWidth:1,borderColor:C.line,paddingHorizontal:14,paddingVertical:12},
  bottomText:{textAlign:"right",fontSize:11,color:"#AACCFF",fontWeight:"700"}
});
