import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { shortDate, isApprovedBusinessOrder } from "../ui/theme";
import type { SupplierOrder } from "./SupplierOrderDetailScreen";

const BLACK="#081329",GRAY="#66738A",LINE="#E0E7EF";
const money=(value:unknown)=>Number(value||0).toLocaleString("tr-TR",{
  minimumFractionDigits:2,maximumFractionDigits:2})+" TL";

export function SupplierOrdersList({orders,onOpen}:{
  orders:SupplierOrder[];onOpen?:(id:number)=>void;
}){
  const [query,setQuery]=useState("");
  const [recentOnly,setRecentOnly]=useState(false);
  const approved=useMemo(()=>orders.filter(x=>isApprovedBusinessOrder(x.status))
    .sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()),[orders]);
  const visible=useMemo(()=>{
    const needle=query.toLocaleLowerCase("tr-TR").trim();
    const weekAgo=Date.now()-7*24*60*60*1000;
    return approved.filter(x=>(!recentOnly||new Date(x.created_at).getTime()>=weekAgo)
      && (!needle||[
      x.order_number,x.order_id,x.customer_company,...(x.items||[]).map(item=>item.name||item.sku)
    ].some(value=>String(value??"").toLocaleLowerCase("tr-TR").includes(needle))));
  },[approved,query,recentOnly]);
  const total=visible.reduce((sum,x)=>sum+Number(x.subtotal||0),0);
  return <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.heading}>Siparişler</Text>
      <Text style={styles.subtitle}>Onaylanmış siparişlerinizi görüntüleyin ve PDF olarak dışa aktarın.</Text>
    </View>
    <View style={styles.search}>
      <Ionicons name="search-outline" size={19} color={GRAY}/>
      <TextInput value={query} onChangeText={setQuery} style={styles.input}
        placeholder="Sipariş no, firma adı veya ürün ara..." placeholderTextColor={GRAY}/>
    </View>
    <View style={styles.filters}>
      <TouchableOpacity accessibilityRole="button" onPress={()=>setRecentOnly(false)}
        style={[styles.activeFilter,recentOnly&&styles.inactiveFilter]}>
        <Text style={[styles.activeFilterLabel,recentOnly&&styles.inactiveLabel]}>Tüm Siparişler</Text>
        <Text style={[styles.count,recentOnly&&styles.inactiveCount]}>{approved.length}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={()=>setRecentOnly(true)}
        style={[styles.activeFilter,!recentOnly&&styles.inactiveFilter]}>
        <Text style={[styles.activeFilterLabel,!recentOnly&&styles.inactiveLabel]}>Son 7 Gün</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.summary}>
      <View><Text style={styles.summaryCaption}>GÖSTERİLEN SİPARİŞ</Text>
        <Text style={styles.summaryValue}>{visible.length}</Text></View>
      <View style={{alignItems:"flex-end"}}><Text style={styles.summaryCaption}>SİPARİŞ TUTARI</Text>
        <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{money(total)}</Text></View>
    </View>
    {!visible.length?<View style={styles.empty}><Text style={styles.emptyTitle}>Onaylanan sipariş bulunamadı.</Text>
      <Text style={styles.subtitle}>{query?"Arama kriterlerini değiştirebilirsiniz.":"Henüz onaylanan sipariş yok."}</Text>
    </View>:visible.map(order=><TouchableOpacity key={String(order.id)} onPress={()=>onOpen?.(Number(order.id))}
      activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={"Sipariş "+order.order_id+" detaylarını aç"}
      style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.orderNo}>{order.order_number||("#CB"+order.order_id)}</Text>
        <View style={styles.tag}><Text style={styles.tagText}>Onaylandı</Text></View>
        <Ionicons name="chevron-forward" color={BLACK} size={20} style={{marginLeft:"auto"}}/>
      </View>
      <Text style={styles.date}>{shortDate(order.created_at)}</Text>
      {order.customer_company?<Text style={styles.company}>{order.customer_company}</Text>:null}
      <View style={styles.cardBottom}>
        <Text style={styles.date}>{(order.items||[]).length} ürün · Detay / PDF</Text>
        <Text style={styles.amount}>{money(order.subtotal)}</Text>
      </View>
    </TouchableOpacity>)}
  </View>;
}
const styles=StyleSheet.create({
  container:{backgroundColor:"#F7F9FC",borderRadius:22,padding:14,marginTop:6,gap:9},
  header:{marginBottom:6},heading:{fontWeight:"900",fontSize:23,color:BLACK},
  subtitle:{color:GRAY,fontSize:12,marginTop:5,lineHeight:18},
  search:{flexDirection:"row",alignItems:"center",gap:8,borderRadius:14,paddingHorizontal:12,
    borderColor:LINE,borderWidth:1,backgroundColor:"#FFFFFF",minHeight:49,marginBottom:6},
  input:{flex:1,fontSize:13,color:BLACK},
  filters:{flexDirection:"row",flexWrap:"wrap",gap:7,marginBottom:2},
  activeFilter:{flexDirection:"row",alignItems:"center",gap:8,backgroundColor:BLACK,
    borderRadius:30,paddingVertical:11,paddingHorizontal:13},
  activeFilterLabel:{color:"#FFFFFF",fontWeight:"800",fontSize:12},
  inactiveFilter:{backgroundColor:"#FFFFFF",borderWidth:1,borderColor:LINE},
  inactiveLabel:{color:BLACK},
  inactiveCount:{backgroundColor:"#E9EEF6",color:BLACK},
  summary:{flexDirection:"row",justifyContent:"space-between",backgroundColor:"#FFF8DE",
    borderRadius:15,padding:14,marginBottom:5},
  summaryCaption:{color:"#7C6C47",fontSize:10,fontWeight:"800",letterSpacing:0.5},
  summaryValue:{color:BLACK,fontSize:19,fontWeight:"900",marginTop:6},
  count:{backgroundColor:"#FFFFFF",color:BLACK,fontSize:11,fontWeight:"900",
    overflow:"hidden",borderRadius:12,paddingHorizontal:7,paddingVertical:2},
  card:{backgroundColor:"#FFFFFF",borderWidth:1,borderColor:LINE,borderRadius:17,
    padding:14,gap:6},
  cardTop:{flexDirection:"row",alignItems:"center",gap:8},
  orderNo:{fontSize:16,fontWeight:"900",color:BLACK},
  tag:{backgroundColor:"#BDF4D7",borderRadius:20,paddingHorizontal:8,paddingVertical:4},
  tagText:{color:"#046C42",fontWeight:"700",fontSize:11},
  date:{fontSize:11,color:GRAY},
  company:{fontSize:13,color:BLACK},
  cardBottom:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  amount:{color:BLACK,fontSize:15,fontWeight:"800"},
  empty:{backgroundColor:"#FFFFFF",borderRadius:14,padding:25,alignItems:"center"},
  emptyTitle:{color:BLACK,fontSize:14,fontWeight:"800"},
});
