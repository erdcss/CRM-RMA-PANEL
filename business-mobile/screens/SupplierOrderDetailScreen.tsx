import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, Share,
  Linking, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../lib/api";
import type { AdminOrder } from "../types";
import { statusMeta } from "../ui/theme";
import { shortDate } from "../ui/theme";

export type SupplierOrder={
  id:number|string;order_id:number|string;order_number?:string|null;created_at:string;status:string;
  cancel_requested_at?:string|null;
  subtotal:number|string;currency?:string;delivery_mode:string;
  payment_method?:string|null;customer_company?:string|null;delivery_address?:string|null;
  items:Array<{
    productId?:number|string;name?:string;sku?:string;
    boxes?:number|string;unitsPerBox?:number|string;price?:number|string;total?:number|string;
  }>;
};
type PdfFormat="standard"|"simple";
const BLUE="#1463E8",DARK="#07112C",GRAY="#627086",BG="#F6F8FC",LINE="#E2E7EF",AMBER="#FFCC00";
const price=(v:unknown)=>{
  const num=Number(v)||0;
  return num.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})+" TL";
};
const paid=(status:string)=>["paid","approved","confirmed","onaylandi"].includes(status);
const orderStatus=(status:string)=>paid(status)?"Onaylandı":"Onay bekliyor";
const payment=(value?:string|null)=>value==="bank_transfer"?"Havale / EFT":
  value==="card"?"Kredi / Banka Kartı":"Belirtilmedi";
const shipping=(value:string)=>value==="warehouse"?"Depo Teslim":
  value==="pickup"?"Mağazadan Teslim":"Doğrudan Teslimat";

function OrderLine({icon,label,value}:{icon:React.ComponentProps<typeof Ionicons>["name"];label:string;value:string}){
  return <View style={styles.detailLine}>
    <View style={styles.detailIcon}><Ionicons name={icon} size={22} color={DARK}/></View>
    <View style={{flex:1,minWidth:0}}>
      <Text style={styles.mutedLabel}>{label}</Text>
      <Text style={styles.detailText} selectable>{value}</Text>
    </View>
  </View>;
}
export function SupplierOrderDetailScreen({id,onBack,adminMode=false}:{id:number|string;onBack:()=>void;adminMode?:boolean}){
  const [adminDetails,setAdminDetails]=useState<AdminOrder|null>(null);
  const [adminPrivateOpen,setAdminPrivateOpen]=useState(false);
  const [bankChecked,setBankChecked]=useState(false);
  const [bankBusy,setBankBusy]=useState(false);
  const [bankNotice,setBankNotice]=useState("");
  const [order,setOrder]=useState<SupplierOrder|null>(null);
  const [busy,setBusy]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [error,setError]=useState("");
  const [showPdf,setShowPdf]=useState(false);
  const [pdfType,setPdfType]=useState<PdfFormat>("standard");
  const load=useCallback(async()=>{
    setError("");
    try{
      if(adminMode){
        // Server-side admin-only API. A supplier never requests this endpoint.
        const data=await apiFetch<AdminOrder>("/api/admin/orders/"+encodeURIComponent(String(id)));
        const billing=data.billing_details||{};
        const address=data.shipping_address||{};
        setAdminDetails(data);
        setOrder({
          id:data.id,order_id:data.id,order_number:data.order_number||null,
          created_at:data.created_at||"",status:data.status||"pending",
          subtotal:data.total_amount||0,payment_method:data.payment_method,
          delivery_mode:data.shipping_method||"",
          customer_company:billing.companyName||data.customer_name||null,
          delivery_address:[address.addressLine,address.district,address.city].filter(Boolean).join(", "),
          cancel_requested_at:data.cancel_requested_at,
          items:(data.items||[]).map(item=>({
            productId:item.productId||item.id,name:item.name||item.title,sku:item.sku,
            boxes:item.quantity||item.qty||1,unitsPerBox:1,
            price:item.price,total:item.total||item.totalPrice||item.price,
          })),
        });
      }else{
        // Supplier sees only the server-approved safe order projection.
        const own=await apiFetch<SupplierOrder[]>("/api/marketplace/seller/orders");
        const found=own.find(item=>Number(item.id)===Number(id));
        if(!found)throw new Error("Bu siparişe erişim izniniz yok.");
        setAdminDetails(null);
        setOrder(found);
      }
    }catch(e){setOrder(null);setError(e instanceof Error?e.message:"Sipariş yüklenemedi");}
    finally{setBusy(false);setRefreshing(false);}
  },[id,adminMode]);
  useEffect(()=>{void load();},[load]);
  const orderNo=order?(order.order_number||"#CB"+String(order.order_id)):"—";
  const products=useMemo(()=>order?.items||[],[order]);
  const quantity=products.reduce((total,item)=>total+Number(item.boxes||0)*Number(item.unitsPerBox||1),0);

  async function exportPdf(){
    if(!order||exporting)return;
    setExporting(true);
    try{
      const path=adminMode
        ? "/api/admin/orders/"+encodeURIComponent(String(order.id))+"/pdf-link"
        : "/api/marketplace/seller/orders/"+encodeURIComponent(String(order.id))+"/pdf-link";
      const r=await apiFetch<{url:string}>(path,{
        method:"POST",body:JSON.stringify({variant:pdfType}),
      });
      const target=new URL(r.url);
      if(target.protocol!=="https:"||target.hostname!=="admin.ecalisgan.com"||
         !/^\/api\/(?:marketplace\/seller|admin)\/orders\/pdf\/[0-9a-f]{64}$/.test(target.pathname))
        throw new Error("PDF adresi doğrulanamadı.");
      await Linking.openURL(r.url);
      setShowPdf(false);
    }catch(e){Alert.alert("PDF oluşturulamadı",e instanceof Error?e.message:"Tekrar deneyin.");}
    finally{setExporting(false);}
  }
  async function approveBankPayment(){
    if(!adminMode||!adminDetails||!bankChecked||bankBusy)return;
    setBankBusy(true);setBankNotice("");
    try{
      const result=await apiFetch<{ok:boolean;notificationRecorded:boolean}>(
        "/api/admin/orders/"+encodeURIComponent(String(id))+"/approve-bank-payment",
        {method:"POST",body:JSON.stringify({bankStatementChecked:true})},
      );
      setBankChecked(false);
      setBankNotice(result.notificationRecorded
        ? "Havale onaylandı. Müşteriye bildirim gönderildi."
        : "Havale onaylandı. Bildirim merkezini kontrol edin.");
      await load();
    }catch(e){setBankNotice(e instanceof Error?e.message:"Ödeme onaylanamadı.");}
    finally{setBankBusy(false);}
  }
  async function shareOrder(){
    if(!order)return;
    try{await Share.share({message:"Çalışkan Business · Sipariş "+orderNo+
      "\nTarih: "+shortDate(order.created_at)+"\nToplam: "+price(order.subtotal)});}
    catch{/* Sharing is optional. */}
  }
  return <View style={styles.page}>
    <View style={styles.topBar}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Siparişlere dön" onPress={onBack}
        style={styles.back}><Ionicons name="chevron-back" size={25} color={DARK}/></TouchableOpacity>
      <Text style={styles.topTitle}>Sipariş Detayı</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sipariş özetini paylaş"
        style={styles.share} onPress={()=>void shareOrder()}>
        <Ionicons name="share-social-outline" size={22} color={DARK}/>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.topPdf}
        onPress={()=>setShowPdf(true)} disabled={!order}>
        <Ionicons name="document-outline" size={18} color="#FFFFFF"/>
        <Text style={styles.topPdfText}>PDF İndir</Text>
      </TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>}>
      {busy?<ActivityIndicator style={{marginTop:70}} size="large" color={BLUE}/>:null}
      {error?<View style={styles.panel}><Text style={styles.error}>{error}</Text>
        <TouchableOpacity onPress={()=>void load()}><Text style={styles.link}>Yeniden dene</Text></TouchableOpacity>
      </View>:null}
      {order&&!busy?<>
        <View style={styles.panel}>
          <View style={styles.headingRow}>
            <View style={{flex:1}}>
              <Text style={styles.mutedLabel}>Sipariş Numarası</Text>
              <View style={styles.rowWrap}><Text selectable style={styles.number}>{orderNo}</Text>
                <View style={styles.approved}><Text style={styles.approvedText}>{adminMode?statusMeta(order.status).label:orderStatus(order.status)}</Text></View>
              </View>
            </View>
            <View style={{alignItems:"flex-end"}}>
              <Text style={styles.mutedLabel}>Sipariş Tarihi</Text>
              <Text style={styles.boldText}>{shortDate(order.created_at)}</Text>
            </View>
          </View>
        </View>
        {(order.customer_company||order.delivery_address)?<View style={styles.panel}>
          {order.customer_company?<OrderLine icon="business-outline" label="Müşteri Firma"
            value={order.customer_company}/>:null}
          {order.customer_company&&order.delivery_address?<View style={styles.rule}/>:null}
          {order.delivery_address?<OrderLine icon="location-outline" label="Teslimat Adresi"
            value={order.delivery_address}/>:null}
        </View>:null}
        <View style={styles.infoTiles}>
          <View style={styles.infoTile}>
            <Ionicons name="business-outline" size={25} color={BLUE}/>
            <View style={{flex:1}}>
              <Text style={styles.blueCaption}>Ödeme Yöntemi</Text>
              <Text style={styles.boldText}>{payment(order.payment_method)}</Text>
            </View>
          </View>
          <View style={styles.infoTile}>
            <Ionicons name="car-outline" size={27} color={BLUE}/>
            <View style={{flex:1}}>
              <Text style={styles.blueCaption}>Kargo Türü</Text>
              <Text style={styles.boldText}>{shipping(order.delivery_mode)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.panel}>
          <View style={styles.productsHeader}>
            <Text style={styles.sectionTitle}>Sipariş Ürünleri</Text>
            <Text style={styles.count}>({products.length})</Text>
          </View>
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeading,{flex:1.55}]}>Ürün</Text>
            <Text style={[styles.tableHeading,{flex:0.6,textAlign:"center"}]}>Adet</Text>
            <Text style={[styles.tableHeading,{flex:0.9,textAlign:"right"}]}>Toplam</Text>
          </View>
          {products.length?products.map((item,index)=><View key={index}
            style={[styles.productRow,index>0&&{borderTopColor:LINE,borderTopWidth:1}]}>
            <View style={styles.productIcon}><Ionicons name="cube-outline" size={22} color={DARK}/></View>
            <View style={{flex:1.55,minWidth:0}}>
              <Text style={styles.productName}>{item.name||"Ürün"}</Text>
              <Text style={styles.productSku}>{item.sku||"Ürün kodu yok"}</Text>
              <Text style={styles.productSku}>{price(item.price)} / birim</Text>
            </View>
            <Text style={[styles.productCount,{flex:0.6}]}>{Number(item.boxes||0)*Number(item.unitsPerBox||1)}</Text>
            <Text style={[styles.productPrice,{flex:0.9}]}>{price(item.total)}</Text>
          </View>):<Text style={styles.productSku}>Bu siparişte ürün bulunamadı.</Text>}
          <View style={styles.totalBlock}>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Ürün Çeşidi</Text>
              <Text style={styles.boldText}>{products.length}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Toplam Adet</Text>
              <Text style={styles.boldText}>{quantity}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Ara Toplam</Text>
              <Text style={styles.boldText}>{price(order.subtotal)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Kargo</Text>
              <Text style={styles.totalLabel}>Bu belgede ayrıca hesaplanmadı</Text></View>
            <View style={styles.grandTotal}>
              <Text style={styles.grandLabel}>Sipariş Toplamı</Text>
              <Text style={styles.grandValue}>{price(order.subtotal)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.panel}>
          <View style={styles.productsHeader}>
            <Ionicons name="information-circle-outline" size={19} color={BLUE}/>
            <Text style={styles.sectionTitle}>Diğer Bilgiler</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Durum</Text>
            <Text style={styles.boldText}>{adminMode?statusMeta(order.status).label:orderStatus(order.status)}</Text>
          </View>
          <View style={[styles.totalRow,{marginTop:12}]}>
            <Text style={styles.totalLabel}>Ürün Adedi</Text>
            <Text style={styles.boldText}>{quantity}</Text>
          </View>
          <View style={[styles.totalRow,{marginTop:12}]}>
            <Text style={styles.totalLabel}>Sipariş Tarihi</Text>
            <Text style={styles.boldText}>{shortDate(order.created_at)}</Text>
          </View>
          {adminMode?<View style={[styles.totalRow,{marginTop:12}]}>
            <Text style={styles.totalLabel}>İptal Talebi</Text>
            <Text style={styles.boldText}>{order.cancel_requested_at?shortDate(order.cancel_requested_at):"Yok"}</Text>
          </View>:null}
          <View style={[styles.privacy,{marginTop:16,backgroundColor:"#F4F7FB",borderRadius:12,padding:12}]}>
            <Ionicons name="document-text-outline" color={BLUE} size={20}/>
            <Text style={styles.privacyText}>Tedarikçiye müşteri iletişim bilgileri gösterilmez ve PDF'ye eklenmez.</Text>
          </View>
        </View>
        {adminMode&&adminDetails?<View style={styles.panel}>
          <TouchableOpacity onPress={()=>setAdminPrivateOpen(v=>!v)} accessibilityRole="button">
            <View style={styles.totalRow}>
              <Text style={styles.sectionTitle}>Yöneticiye Özel Bilgiler</Text>
              <Ionicons name={adminPrivateOpen?"chevron-up":"chevron-down"} size={20} color={GRAY}/>
            </View>
            <Text style={styles.previewDetail}>Yalnızca yetkili yönetici hesabında görüntülenir.</Text>
          </TouchableOpacity>
          {adminPrivateOpen?<View style={{marginTop:14,gap:12}}>
            {[
              ["Müşteri e-postası",adminDetails.customer_email],
              ["Telefon",adminDetails.billing_details?.phone||adminDetails.shipping_address?.phone],
              ["Yetkili",adminDetails.billing_details?.recipient||adminDetails.shipping_address?.recipient],
              ["Vergi numarası",adminDetails.billing_details?.taxNumber],
              ["Vergi dairesi",adminDetails.billing_details?.taxOffice],
              ["Havale kodu",adminDetails.transfer_code],
            ].filter((entry)=>Boolean(entry[1])).map(([label,value])=><View key={label} style={styles.totalRow}>
              <Text style={styles.totalLabel}>{label}</Text>
              <Text selectable style={styles.boldText}>{String(value)}</Text>
            </View>)}
          </View>:null}
        </View>:null}
        {adminMode&&adminDetails?.payment_method==="bank_transfer"&&
          adminDetails.status==="awaiting_bank_confirmation"&&
          adminDetails.payment_status==="customer_reported_paid"?
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Banka Havalesini Onayla</Text>
            <Text style={[styles.previewDetail,{marginBottom:10}]}>Banka hareketini ve havale kodunu doğrulayın.</Text>
            <TouchableOpacity onPress={()=>setBankChecked(v=>!v)} accessibilityRole="checkbox"
              accessibilityState={{checked:bankChecked}} style={styles.totalRow}>
              <Ionicons name={bankChecked?"checkbox":"square-outline"} size={23} color={BLUE}/>
              <Text style={[styles.totalLabel,{flex:1,marginLeft:10}]}>Banka hareketindeki tutarı ve kodu doğruladım.</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={!bankChecked||bankBusy} onPress={()=>void approveBankPayment()}
              style={[styles.exportButton,{marginTop:14},(!bankChecked||bankBusy)&&{opacity:0.45}]}>
              <Text style={styles.exportButtonText}>{bankBusy?"Onaylanıyor...":"Havale Ödemesini Onayla"}</Text>
            </TouchableOpacity>
          </View>:null}
        {bankNotice?<Text style={styles.previewDetail}>{bankNotice}</Text>:null}
        <TouchableOpacity style={styles.exportButton} onPress={()=>setShowPdf(true)}>
          <Ionicons name="download-outline" size={21} color="#FFFFFF"/>
          <Text style={styles.exportButtonText}>Siparişi PDF Olarak Dışa Aktar</Text>
        </TouchableOpacity>
        <View style={styles.privacy}>
          <Ionicons name="shield-checkmark" color="#15803D" size={17}/>
          <Text style={styles.privacyText}>Müşteri telefon numarası ve e-posta bilgileri tedarikçilerle paylaşılmaz.
            Bu bilgiler yalnızca yetkili yönetici hesaplarında bulunur.</Text>
        </View>
      </>:null}
    </ScrollView>
    <Modal transparent animationType="slide" visible={showPdf} onRequestClose={()=>setShowPdf(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <View style={{flex:1}}><Text style={styles.sheetTitle}>Siparişi PDF Olarak Dışa Aktar</Text>
              <Text style={styles.sheetDescription}>İstediğiniz belge biçimini seçin.</Text></View>
            <TouchableOpacity accessibilityLabel="Kapat" onPress={()=>setShowPdf(false)}>
              <Ionicons name="close" color={DARK} size={25}/>
            </TouchableOpacity>
          </View>
          <View style={styles.formatRow}>
            {([{id:"standard",label:"Standart Tasarım",description:"Detaylı sipariş belgesi",icon:"document-text-outline"},
              {id:"simple",label:"Sade Liste",description:"Yalnızca ürün listesi",icon:"receipt-outline"}] as const)
              .map(value=><TouchableOpacity key={value.id}
                style={[styles.formatCard,pdfType===value.id&&styles.formatSelected]}
                onPress={()=>setPdfType(value.id)}>
                <Ionicons name={value.icon} size={25} color={pdfType===value.id?BLUE:GRAY}/>
                <Text style={styles.formatTitle}>{value.label}</Text>
                <Text style={styles.formatCaption}>{value.description}</Text>
              </TouchableOpacity>)}
          </View>
          <View style={styles.preview}>
            <View style={styles.previewTop}><View style={styles.previewLogo}>
              <Text style={styles.previewLogoText}>ÇALIŞKAN</Text></View>
              <Text style={styles.previewTitle}>ÇALIŞKAN BUSINESS</Text>
              <Text style={styles.previewBadge}>SİPARİŞ DETAYI</Text>
            </View>
            <View style={styles.rule}/>
            <Text style={styles.previewDetail}>{orderNo}     {order?shortDate(order.created_at):""}</Text>
            {pdfType==="standard"&&order?.customer_company?
              <Text style={styles.previewDetail}>Firma: {order.customer_company}</Text>:null}
            <View style={styles.previewColumns}><Text style={styles.previewCol}>ÜRÜN</Text>
              <Text style={styles.previewCol}>KOLİ</Text><Text style={styles.previewCol}>TUTAR</Text></View>
            {products.slice(0,4).map((item,index)=><View key={index} style={styles.previewProduct}>
              <Text style={styles.previewItem} numberOfLines={1}>{item.name||"Ürün"}</Text>
              <Text style={styles.previewItem}>{item.boxes||0}</Text>
              <Text style={styles.previewItem}>{price(item.total)}</Text>
            </View>)}
            {products.length>4?<Text style={styles.previewDetail}>+{products.length-4} ürün daha</Text>:null}
            <View style={styles.previewTotal}><Text style={styles.previewTotalText}>
              Toplam: {price(order?.subtotal)}</Text></View>
            <Text style={styles.previewFootnote}>Sipariş özetidir, resmi fatura yerine geçmez. Telefon / e-posta içermez.</Text>
          </View>
          <TouchableOpacity disabled={!order||exporting}
            style={[styles.downloadButton,exporting&&{opacity:0.6}]} onPress={()=>void exportPdf()}>
            {exporting?<ActivityIndicator color="#FFFFFF"/>:<Ionicons name="download-outline" size={20} color="#FFFFFF"/>}
            <Text style={styles.downloadText}>{exporting?"PDF hazırlanıyor...":"PDF İndir"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:BG},
  topBar:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:12,paddingVertical:11,
    borderBottomColor:LINE,borderBottomWidth:1,backgroundColor:"#FFFFFF"},
  back:{width:34,height:40,justifyContent:"center",alignItems:"center"},
  topTitle:{color:DARK,fontSize:17,fontWeight:"800",flex:1,textAlign:"center"},
  share:{width:32,height:40,justifyContent:"center",alignItems:"center"},
  topPdf:{backgroundColor:DARK,flexDirection:"row",alignItems:"center",gap:6,
    borderRadius:11,paddingHorizontal:11,minHeight:39},
  topPdfText:{color:"#FFFFFF",fontSize:12,fontWeight:"800"},
  content:{padding:14,paddingBottom:48,gap:12},
  panel:{backgroundColor:"#FFFFFF",borderRadius:17,borderColor:LINE,borderWidth:1,
    paddingHorizontal:15,paddingVertical:16},
  headingRow:{flexDirection:"row",gap:10,alignItems:"center"},
  mutedLabel:{color:GRAY,fontSize:11,marginBottom:5},
  number:{color:DARK,fontWeight:"900",fontSize:17},
  boldText:{color:DARK,fontWeight:"700",fontSize:13},
  rowWrap:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:8},
  approved:{backgroundColor:"#BDF4D7",paddingVertical:4,paddingHorizontal:9,borderRadius:30},
  approvedText:{color:"#067441",fontWeight:"700",fontSize:11},
  rule:{height:1,backgroundColor:LINE,marginVertical:13},
  detailLine:{flexDirection:"row",gap:12,alignItems:"center"},
  detailIcon:{height:43,width:43,borderRadius:12,backgroundColor:"#F1F4F8",
    justifyContent:"center",alignItems:"center"},
  detailText:{color:DARK,fontSize:14,fontWeight:"700",lineHeight:21},
  infoTiles:{flexDirection:"row",gap:9},
  infoTile:{flex:1,minWidth:0,backgroundColor:"#EDF7FF",borderRadius:14,
    paddingVertical:14,paddingHorizontal:9,flexDirection:"row",alignItems:"center",gap:8},
  blueCaption:{color:BLUE,fontSize:10,fontWeight:"700",marginBottom:5},
  productsHeader:{flexDirection:"row",alignItems:"center",marginBottom:13,gap:6},
  sectionTitle:{color:DARK,fontSize:16,fontWeight:"800"},
  count:{color:GRAY,fontSize:12},
  tableHead:{backgroundColor:"#F1F4F8",borderRadius:9,padding:10,flexDirection:"row"},
  tableHeading:{color:"#5E6C7D",fontSize:11,fontWeight:"700"},
  productRow:{minHeight:74,flexDirection:"row",alignItems:"center",gap:9,paddingVertical:11},
  productIcon:{height:39,width:39,borderRadius:10,backgroundColor:"#F1F4F8",
    alignItems:"center",justifyContent:"center"},
  productName:{color:DARK,fontWeight:"700",fontSize:12},
  productSku:{color:GRAY,fontSize:10,marginTop:4},
  productCount:{color:DARK,textAlign:"center",fontSize:12},
  productPrice:{color:DARK,textAlign:"right",fontWeight:"700",fontSize:11},
  totalBlock:{paddingTop:14,borderTopColor:LINE,borderTopWidth:1,gap:10},
  totalRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},
  totalLabel:{color:GRAY,fontSize:11},
  grandTotal:{backgroundColor:"#ECF5FF",borderRadius:10,padding:12,
    flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  grandLabel:{fontSize:15,fontWeight:"800",color:DARK},
  grandValue:{fontSize:15,fontWeight:"900",color:DARK},
  exportButton:{height:54,borderRadius:14,backgroundColor:DARK,
    flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},
  exportButtonText:{color:"#FFFFFF",fontWeight:"800",fontSize:13},
  privacy:{flexDirection:"row",alignItems:"flex-start",gap:8,paddingHorizontal:4,paddingTop:2},
  privacyText:{flex:1,color:GRAY,fontSize:11,lineHeight:17},
  error:{color:"#B91C1C",fontSize:13,marginBottom:15},
  link:{color:BLUE,fontWeight:"700",fontSize:14},
  modalOverlay:{flex:1,backgroundColor:"rgba(5,14,31,.50)",justifyContent:"flex-end"},
  sheet:{backgroundColor:"#FFFFFF",borderTopLeftRadius:25,borderTopRightRadius:25,padding:16,
    maxHeight:"95%"},
  sheetHead:{flexDirection:"row",alignItems:"flex-start",gap:12,marginBottom:18},
  sheetTitle:{color:DARK,fontSize:17,fontWeight:"800"},
  sheetDescription:{color:GRAY,fontSize:12,marginTop:5},
  formatRow:{flexDirection:"row",gap:10,marginBottom:14},
  formatCard:{flex:1,borderRadius:13,borderColor:LINE,borderWidth:1,padding:10,gap:5,minWidth:0},
  formatSelected:{borderColor:BLUE,backgroundColor:"#EEF6FF"},
  formatTitle:{color:DARK,fontSize:12,fontWeight:"800"},
  formatCaption:{color:GRAY,fontSize:10,lineHeight:15},
  preview:{minHeight:210,borderColor:LINE,borderWidth:1,borderRadius:14,
    padding:15,marginBottom:14,backgroundColor:"#FFFFFF"},
  previewTop:{flexDirection:"row",alignItems:"center",gap:7},
  previewLogo:{backgroundColor:AMBER,borderRadius:7,padding:6},
  previewLogoText:{color:DARK,fontSize:9,fontWeight:"900"},
  previewTitle:{color:DARK,fontWeight:"900",fontSize:11,flex:1},
  previewBadge:{color:DARK,fontSize:8,fontWeight:"800"},
  previewDetail:{color:GRAY,fontSize:10,marginTop:9},
  previewColumns:{marginTop:13,flexDirection:"row",justifyContent:"space-between",
    backgroundColor:"#F1F4F8",padding:8,borderRadius:5},
  previewCol:{color:GRAY,fontSize:9,fontWeight:"800"},
  previewProduct:{flexDirection:"row",justifyContent:"space-between",paddingVertical:7,
    borderBottomWidth:1,borderBottomColor:LINE},
  previewItem:{fontSize:9,color:DARK,maxWidth:"55%"},
  previewTotal:{marginTop:12,backgroundColor:"#EDF7FF",alignItems:"flex-end",
    padding:9,borderRadius:7},
  previewTotalText:{fontWeight:"800",fontSize:11,color:BLUE},
  previewFootnote:{fontSize:9,color:GRAY,marginTop:9},
  downloadButton:{height:55,borderRadius:13,backgroundColor:DARK,flexDirection:"row",
    alignItems:"center",justifyContent:"center",gap:10},
  downloadText:{color:"#FFFFFF",fontSize:15,fontWeight:"800"},
});
