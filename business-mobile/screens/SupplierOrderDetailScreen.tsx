import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../lib/api";
import { C, money, shortDate } from "../ui/theme";

export type SupplierOrder = {
  id:number;
  order_id:number;
  created_at:string;
  status:string;
  subtotal:number|string;
  currency?:string;
  delivery_mode:string;
  items:Array<{
    productId?:number|string;name?:string;sku?:string;
    boxes?:number|string;unitsPerBox?:number|string;
    price?:number|string;total?:number|string;
  }>;
};

export function SupplierOrderDetailScreen({id,onBack}:{id:number;onBack:()=>void}) {
  const [order,setOrder]=useState<SupplierOrder|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setError("");
    try{
      // The server only returns the authenticated supplier's own allowlisted orders.
      // Never fetch /api/admin/orders or render addresses, phones or customer details.
      const own=await apiFetch<SupplierOrder[]>("/api/marketplace/seller/orders");
      const found=own.find(value=>Number(value.id)===Number(id));
      if(!found)throw new Error("Bu siparişe erişim yetkiniz yok veya sipariş bulunamadı.");
      setOrder(found);
    }catch(e){setOrder(null);setError(e instanceof Error?e.message:"Sipariş alınamadı");}
    finally{setLoading(false);setRefreshing(false);}
  },[id]);
  useEffect(()=>{void load();},[load]);

  const exportPdf=async()=>{
    if(!order||exporting)return;
    setExporting(true);
    try{
      const result=await apiFetch<{url:string}>("/api/marketplace/seller/orders/"+encodeURIComponent(String(order.id))+"/pdf-link",{
        method:"POST",body:JSON.stringify({})
      });
      if(!result.url.startsWith("https://admin.ecalisgan.com/api/marketplace/seller/orders/pdf/"))
        throw new Error("PDF bağlantısı doğrulanamadı.");
      await Linking.openURL(result.url);
    }catch(e){
      Alert.alert("PDF dışa aktarılamadı",e instanceof Error?e.message:"Lütfen yeniden deneyin.");
    }finally{setExporting(false);}
  };

  return <ScrollView style={s.page} contentContainerStyle={s.content}
    refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.text}
      onRefresh={()=>{setRefreshing(true);void load();}} />}>
    <View style={s.top}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Siparişlere dön"
        onPress={onBack} style={s.back}>
        <Ionicons name="arrow-back" size={21} color={C.text}/>
      </TouchableOpacity>
      <View style={s.headingBlock}>
        <Text style={s.eyebrow}>ÇALIŞKAN BUSINESS</Text>
        <Text style={s.heading}>Sipariş Detayı</Text>
      </View>
      <View style={s.topSymbol}><Ionicons name="receipt-outline" size={23} color={C.text}/></View>
    </View>

    {loading?<ActivityIndicator style={{marginTop:60}} size="large" color={C.blue}/>:null}
    {error?<View style={s.empty}><Ionicons name="alert-circle-outline" color={C.red} size={28}/>
      <Text style={s.error}>{error}</Text>
      <TouchableOpacity style={s.retry} onPress={()=>void load()}>
        <Text style={s.retryText}>Tekrar Dene</Text>
      </TouchableOpacity>
    </View>:null}

    {order&&!loading?<>
      <View style={s.hero}>
        <View style={s.heroTop}>
          <View style={s.heroIcon}><Ionicons name="bag-check-outline" size={22} color="#FACC15"/></View>
          <View style={s.status}><View style={s.dot}/><Text style={s.statusText}>
            {order.status==="paid"?"Ödeme Alındı":order.status==="pending_confirmation"?"Onay Bekliyor":"Sipariş Oluşturuldu"}
          </Text></View>
        </View>
        <Text style={s.heroOverline}>SİPARİŞ TOPLAMI</Text>
        <Text style={s.heroMoney}>{money(order.subtotal)}</Text>
        <View style={s.heroDivider}/>
        <View style={s.heroBottom}>
          <View><Text style={s.lightLabel}>Sipariş No</Text>
            <Text selectable style={s.heroNo}>#{order.order_id}</Text></View>
          <View style={{alignItems:"flex-end",flexShrink:1}}>
            <Text style={s.lightLabel}>Sipariş Tarihi</Text>
            <Text style={s.heroDate}>{shortDate(order.created_at)}</Text>
          </View>
        </View>
      </View>

      <View style={s.sectionTop}><Text style={s.sectionTitle}>Sipariş Bilgileri</Text>
        <Ionicons name="information-circle-outline" color={C.muted} size={19}/>
      </View>
      <View style={s.panel}>
        <InfoRow label="Sipariş" value={"#"+order.order_id}/>
        <InfoRow label="Durum" value={order.status==="paid"?"Ödendi":"Onay Bekliyor"}/>
        <InfoRow label="Teslimat Türü" value={order.delivery_mode==="warehouse"?"Depo Teslim":"Doğrudan Teslimat"}/>
        <InfoRow label="Ürün Çeşidi" value={String(order.items?.length||0)} last/>
      </View>

      <View style={s.sectionTop}><Text style={s.sectionTitle}>Siparişteki Ürünler</Text>
        <View style={s.countPill}><Text style={s.countText}>{order.items?.length||0} Ürün</Text></View>
      </View>
      <View style={s.panel}>
        {!order.items?.length ? <Text style={s.emptyItems}>Bu siparişte ürün bulunamadı.</Text> :
        order.items.map((item,index)=><View key={index} style={[s.productRow,index>0&&s.productBorder]}>
          <View style={s.productGlyph}><Ionicons name="cube-outline" size={23} color="#FACC15"/></View>
          <View style={s.productMain}>
            <Text style={s.productTitle}>{item.name||item.sku||"Ürün"}</Text>
            <Text style={s.productSku}>{item.sku?"Kod: "+item.sku:"Ürün "+(index+1)}</Text>
            <Text style={s.productQty}>{Number(item.boxes||0)} koli · Koli içi {Number(item.unitsPerBox||1)} adet</Text>
          </View>
          <View style={s.productPrice}>
            <Text style={s.productTotal}>{money(item.total)}</Text>
            <Text style={s.productUnit}>{money(item.price)} / birim</Text>
          </View>
        </View>)}
      </View>

      <View style={s.totalPanel}>
        <View style={s.totalRow}><Text style={s.totalMuted}>Ara Toplam</Text>
          <Text style={s.totalNormal}>{money(order.subtotal)}</Text></View>
        <View style={s.totalRule}/>
        <View style={s.totalRow}><Text style={s.grandText}>Sipariş Toplamı</Text>
          <Text style={s.grandPrice}>{money(order.subtotal)}</Text></View>
      </View>
      <View style={s.privacy}>
        <Ionicons name="shield-checkmark-outline" size={18} color={C.green}/>
        <Text style={s.privacyText}>
          Müşteri iletişim bilgileri yalnızca yetkili yönetici hesabında görüntülenebilir.
        </Text>
      </View>
      <TouchableOpacity disabled={exporting} accessibilityRole="button"
        onPress={()=>void exportPdf()} style={[s.exportButton,exporting&&{opacity:0.55}]}>
        {exporting?<ActivityIndicator color="#111827"/>:<Ionicons name="document-text-outline" size={21} color="#111827"/>}
        <Text style={s.exportText}>{exporting?"PDF Hazırlanıyor…":"PDF Olarak Dışa Aktar"}</Text>
        <Ionicons name="download-outline" size={20} color="#111827"/>
      </TouchableOpacity>
      <Text style={s.pdfNote}>PDF yalnızca sipariş ürünlerini, miktarları, tarih ve toplamı içerir; müşteri telefonu ve iletişim bilgileri paylaşılmaz.</Text>
    </>:null}
  </ScrollView>;
}
function InfoRow({label,value,last=false}:{label:string;value:string;last?:boolean}){
  return <View style={[s.infoRow,!last&&s.infoBorder]}>
    <Text style={s.infoLabel}>{label}</Text>
    <Text style={s.infoValue}>{value}</Text>
  </View>;
}
const s=StyleSheet.create({
  page:{flex:1,backgroundColor:C.bg},
  content:{paddingHorizontal:18,paddingTop:10,paddingBottom:48},
  top:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:22},
  back:{width:44,height:44,borderRadius:14,backgroundColor:C.panel,borderColor:C.line,borderWidth:1,alignItems:"center",justifyContent:"center"},
  headingBlock:{flex:1},eyebrow:{color:C.muted,fontSize:10,fontWeight:"800",letterSpacing:1.2},
  heading:{color:C.text,fontSize:23,fontWeight:"800",marginTop:2},
  topSymbol:{width:44,height:44,borderRadius:14,backgroundColor:C.panel2,alignItems:"center",justifyContent:"center"},
  hero:{borderRadius:24,backgroundColor:"#111A27",padding:20,borderWidth:1,borderColor:"#2A3D53",marginBottom:24},
  heroTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:22},
  heroIcon:{width:46,height:46,borderRadius:15,backgroundColor:"#263241",alignItems:"center",justifyContent:"center"},
  status:{flexDirection:"row",alignItems:"center",gap:7,paddingHorizontal:11,paddingVertical:8,backgroundColor:"rgba(52,211,153,0.12)",borderRadius:20},
  dot:{width:6,height:6,borderRadius:3,backgroundColor:C.green},
  statusText:{color:C.green,fontSize:11,fontWeight:"700"},
  heroOverline:{color:"#98A7BA",fontSize:11,fontWeight:"700",letterSpacing:1},
  heroMoney:{color:"#FFFFFF",fontSize:34,fontWeight:"800",marginTop:5},
  heroDivider:{height:1,backgroundColor:"#334155",marginVertical:19},
  heroBottom:{flexDirection:"row",justifyContent:"space-between",gap:10},
  lightLabel:{color:"#9DACBF",fontSize:11,marginBottom:6},
  heroNo:{color:C.text,fontSize:14,fontWeight:"700"},
  heroDate:{color:C.text,fontSize:12,fontWeight:"600"},
  sectionTop:{marginBottom:11,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  sectionTitle:{color:C.text,fontSize:17,fontWeight:"800"},
  countPill:{borderRadius:14,paddingHorizontal:10,paddingVertical:6,backgroundColor:C.panel2},
  countText:{color:C.text2,fontSize:11,fontWeight:"700"},
  panel:{borderRadius:20,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,marginBottom:24,paddingHorizontal:16},
  infoRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",minHeight:53,gap:12},
  infoBorder:{borderBottomColor:C.line,borderBottomWidth:StyleSheet.hairlineWidth},
  infoLabel:{color:C.muted,fontSize:12},
  infoValue:{color:C.text,fontSize:13,fontWeight:"600",textAlign:"right",flexShrink:1},
  productRow:{flexDirection:"row",paddingVertical:17,gap:12,alignItems:"center"},
  productBorder:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.line},
  productGlyph:{width:46,height:46,borderRadius:13,backgroundColor:"#222C3A",alignItems:"center",justifyContent:"center"},
  productMain:{flex:1},productTitle:{color:C.text,fontWeight:"700",fontSize:13},
  productSku:{color:C.muted,marginTop:4,fontSize:10},productQty:{color:C.text2,marginTop:5,fontSize:11},
  productPrice:{alignItems:"flex-end",flexShrink:1},productTotal:{color:C.text,fontSize:13,fontWeight:"700"},
  productUnit:{color:C.muted,fontSize:10,marginTop:5},
  emptyItems:{paddingVertical:20,color:C.muted},
  totalPanel:{backgroundColor:C.panel2,borderRadius:20,borderWidth:1,borderColor:C.line,padding:18,marginBottom:16},
  totalRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:12},
  totalMuted:{color:C.muted,fontSize:13},totalNormal:{color:C.text,fontSize:14,fontWeight:"600"},
  totalRule:{height:1,backgroundColor:C.line,marginVertical:17},
  grandText:{color:C.text,fontWeight:"800",fontSize:14},
  grandPrice:{color:"#FACC15",fontWeight:"800",fontSize:21},
  privacy:{flexDirection:"row",alignItems:"center",gap:10,marginBottom:18,paddingHorizontal:2},
  privacyText:{color:C.muted,fontSize:11,lineHeight:17,flex:1},
  exportButton:{backgroundColor:"#FACC15",borderRadius:17,minHeight:58,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:12,paddingHorizontal:12},
  exportText:{fontSize:15,color:"#111827",fontWeight:"800",flex:1,textAlign:"center"},
  pdfNote:{fontSize:10,color:C.muted,textAlign:"center",lineHeight:16,marginTop:12},
  empty:{marginTop:25,padding:20,borderRadius:18,backgroundColor:C.panel,alignItems:"center",gap:14},
  error:{color:C.text2,textAlign:"center"},retry:{padding:12,backgroundColor:C.blue,borderRadius:12},
  retryText:{color:"#FFFFFF",fontWeight:"700"},
});
