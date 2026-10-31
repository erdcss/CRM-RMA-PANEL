import { useState, type ComponentProps } from "react";
import {
  Alert, Modal, Pressable, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export type SupplierTab =
  "overview" | "orders" | "products" | "stores" | "reels" | "messages" |
  "returns" | "payments" | "settings";
type Icon = ComponentProps<typeof Ionicons>["name"];

export const supplierTabLabels: Record<SupplierTab,string> = {
  overview:"Genel Bakış",orders:"Siparişler",products:"Ürünlerim",
  stores:"Mağaza Tasarımı",reels:"Reels",messages:"Mesajlar",
  returns:"İadeler",payments:"Ödemeler",settings:"Ayarlar",
};
const MAIN: {tab:SupplierTab;icon:Icon}[]=[
  {tab:"overview",icon:"grid-outline"},
  {tab:"orders",icon:"receipt-outline"},
  {tab:"products",icon:"cube-outline"},
];
const TOOLS: {tab:SupplierTab;icon:Icon;subtitle:string}[]=[
  {tab:"stores",icon:"storefront-outline",subtitle:"Mağaza görünümünüz"},
  {tab:"reels",icon:"videocam-outline",subtitle:"Ürün videolarınız"},
  {tab:"messages",icon:"chatbubbles-outline",subtitle:"Müşteri görüşmeleri"},
  {tab:"returns",icon:"return-down-back-outline",subtitle:"İade talepleri"},
  {tab:"payments",icon:"wallet-outline",subtitle:"Hakediş ve ödemeler"},
  {tab:"settings",icon:"settings-outline",subtitle:"Hesap ve tatil modu"},
];

const YELLOW="#FFCC00",DARK="#071322",BG="#F5F7FB",MUTED="#657387";

export function SupplierHeader({
  title,company,onMenu,onRefresh,
}:{
  title:string;company:string;onMenu:()=>void;onRefresh:()=>void;
}){
  return <View style={s.header}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tedarikçi menüsünü aç"
      onPress={onMenu} style={s.headerIcon}>
      <Ionicons name="menu-outline" color={DARK} size={25}/>
    </TouchableOpacity>
    <View style={s.headerTitleWrap}>
      <Text style={s.brand}>ÇALIŞKAN <Text style={s.brandAccent}>BUSINESS</Text></Text>
      <Text style={s.pageTitle} numberOfLines={1}>{title}</Text>
      <Text style={s.company} numberOfLines={1}>{company}</Text>
    </View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sayfayı yenile"
      onPress={onRefresh} style={s.headerIcon}>
      <Ionicons name="refresh-outline" color={DARK} size={21}/>
    </TouchableOpacity>
  </View>;
}

export function SupplierBottomNav({tab,onSelect,onMenu}:{
  tab:SupplierTab;onSelect:(next:SupplierTab)=>void;onMenu:()=>void;
}){
  return <View style={s.bottomNav}>
    {MAIN.map(item=><TouchableOpacity key={item.tab}
      accessibilityRole="tab" accessibilityState={{selected:tab===item.tab}}
      accessibilityLabel={supplierTabLabels[item.tab]}
      onPress={()=>onSelect(item.tab)} style={s.bottomItem}>
      <Ionicons name={item.icon} size={21} color={tab===item.tab?DARK:MUTED}/>
      <Text style={[s.bottomLabel,tab===item.tab&&s.bottomLabelActive]}>
        {item.tab==="overview"?"Ana Sayfa":supplierTabLabels[item.tab]}</Text>
      {tab===item.tab?<View style={s.bottomDot}/>:null}
    </TouchableOpacity>)}
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tüm araçları aç"
      onPress={onMenu} style={s.bottomItem}>
      <Ionicons name="menu-outline" size={21} color={MUTED}/>
      <Text style={s.bottomLabel}>Araçlar</Text>
    </TouchableOpacity>
  </View>;
}

export function SupplierDrawer({
  open,onClose,tab,onSelect,onAiAdd,onLogout,company,
}:{
  open:boolean;onClose:()=>void;tab:SupplierTab;
  onSelect:(next:SupplierTab)=>void;onAiAdd:()=>void;
  onLogout:()=>Promise<void>|void;company:string;
}){
  const [loggingOut,setLoggingOut]=useState(false);
  const choose=(next:SupplierTab)=>{onClose();onSelect(next);};
  const confirmLogout=()=>{
    onClose();
    Alert.alert("Çıkış yapılsın mı?",
      "Yalnızca Çıkış Yap seçeneği oturumunuzu sonlandırır.",[
        {text:"Vazgeç",style:"cancel"},
        {text:"Çıkış Yap",style:"destructive",onPress:async()=>{
          if(loggingOut)return;
          setLoggingOut(true);
          try{await onLogout();}
          catch(error){Alert.alert("Çıkış başarısız",error instanceof Error?error.message:"Tekrar deneyin");}
          finally{setLoggingOut(false);}
        }},
      ]);
  };
  function MenuRow({icon,label,subtitle,selected,onPress}:{
    icon:Icon;label:string;subtitle?:string;selected?:boolean;onPress:()=>void;
  }){
    return <TouchableOpacity accessibilityRole="button" onPress={onPress}
      style={[s.drawerRow,selected&&s.drawerSelected]}>
      <View style={[s.drawerRowIcon,selected&&s.drawerSelectedIcon]}>
        <Ionicons name={icon} color={DARK} size={20}/>
      </View>
      <View style={{flex:1}}>
        <Text style={s.drawerRowTitle}>{label}</Text>
        {subtitle?<Text style={s.drawerRowSub}>{subtitle}</Text>:null}
      </View>
      <Ionicons name="chevron-forward-outline" color={MUTED} size={17}/>
    </TouchableOpacity>;
  }
  return <Modal visible={open} transparent animationType="fade"
    statusBarTranslucent onRequestClose={onClose}>
    <View style={s.overlay}>
      <Pressable style={s.scrim} accessibilityRole="button"
        accessibilityLabel="Menüyü kapat" onPress={onClose}/>
      <SafeAreaView style={s.drawer} edges={["top","bottom"]}>
        <View style={s.drawerTop}>
          <View style={{flex:1}}>
            <Text style={s.drawerEyebrow}>ÇALIŞKAN BUSINESS</Text>
            <Text style={s.drawerHeading}>Tedarikçi Merkezi</Text>
            <Text style={s.drawerCompany} numberOfLines={2}>{company}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Menüyü kapat"
            style={s.close} onPress={onClose}>
            <Ionicons name="close-outline" color={DARK} size={24}/>
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.drawerScroll}
          bounces={false} nestedScrollEnabled>
          <Text style={s.sectionLabel}>YÖNETİM</Text>
          {MAIN.map(item=><MenuRow key={item.tab} icon={item.icon}
            label={supplierTabLabels[item.tab]} selected={tab===item.tab}
            onPress={()=>choose(item.tab)}/>)}
          <Text style={[s.sectionLabel,{marginTop:20}]}>ARAÇLAR</Text>
          <MenuRow icon="sparkles-outline" label="Yapay Zekâ ile Ürün Ekle"
            subtitle="Ürün görseli ve bilgilerini hazırlayın" onPress={()=>{onClose();onAiAdd();}}/>
          <MenuRow icon="document-text-outline" label="Sipariş PDF Çıktıları"
            subtitle="Sipariş detayından PDF indirin ve paylaşın"
            onPress={()=>choose("orders")}/>
          {TOOLS.map(item=><MenuRow key={item.tab} icon={item.icon}
            label={supplierTabLabels[item.tab]} subtitle={item.subtitle}
            selected={tab===item.tab} onPress={()=>choose(item.tab)}/>)}
        </ScrollView>
        <View style={s.drawerFoot}>
          <TouchableOpacity accessibilityRole="button" style={s.logout}
            disabled={loggingOut} onPress={confirmLogout}>
            <Ionicons name="log-out-outline" color="#B42318" size={21}/>
            <Text style={s.logoutText}>Güvenli Çıkış Yap</Text>
          </TouchableOpacity>
          <Text style={s.drawerFootnote}>Menü ve geri tuşu oturumunuzu kapatmaz.</Text>
        </View>
      </SafeAreaView>
    </View>
  </Modal>;
}

const s=StyleSheet.create({
  header:{flexDirection:"row",alignItems:"center",gap:12,backgroundColor:"#FFFFFF",
    borderBottomWidth:1,borderBottomColor:"#E7ECF3",paddingHorizontal:15,paddingVertical:13},
  headerIcon:{width:43,height:43,borderRadius:13,backgroundColor:BG,
    justifyContent:"center",alignItems:"center"},
  headerTitleWrap:{flex:1,minWidth:0},
  brand:{fontWeight:"900",fontSize:10,color:DARK,letterSpacing:0.6},
  brandAccent:{color:"#A06B00"},
  pageTitle:{fontSize:19,color:DARK,fontWeight:"900",marginTop:3,letterSpacing:-0.4},
  company:{fontSize:11,color:MUTED,marginTop:2},
  bottomNav:{flexDirection:"row",backgroundColor:"#FFFFFF",borderTopWidth:1,
    borderTopColor:"#E1E6EF",paddingTop:8,paddingBottom:11,paddingHorizontal:8},
  bottomItem:{flex:1,minHeight:52,justifyContent:"center",alignItems:"center",gap:4},
  bottomLabel:{fontSize:10,fontWeight:"700",color:MUTED},
  bottomLabelActive:{color:DARK},
  bottomDot:{position:"absolute",top:-8,width:30,height:3,borderRadius:2,backgroundColor:YELLOW},
  overlay:{flex:1,flexDirection:"row"},
  scrim:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(3,10,20,0.62)"},
  drawer:{width:"86%",maxWidth:365,backgroundColor:"#FFFFFF",
    borderTopRightRadius:23,borderBottomRightRadius:23,overflow:"hidden"},
  drawerTop:{backgroundColor:"#FFF8DC",padding:22,paddingTop:28,flexDirection:"row",gap:10},
  drawerEyebrow:{fontSize:10,color:"#876000",fontWeight:"900",letterSpacing:1},
  drawerHeading:{fontSize:22,color:DARK,fontWeight:"900",marginTop:8},
  drawerCompany:{fontSize:13,color:"#5D6777",marginTop:4},
  close:{width:39,height:39,backgroundColor:"#FFFFFF",borderRadius:12,
    alignItems:"center",justifyContent:"center"},
  drawerScroll:{paddingHorizontal:14,paddingVertical:16,paddingBottom:24},
  sectionLabel:{fontSize:10,fontWeight:"900",letterSpacing:1.2,color:"#8A96A7",
    paddingHorizontal:12,marginBottom:8},
  drawerRow:{flexDirection:"row",alignItems:"center",gap:11,borderRadius:13,
    padding:10,marginBottom:5,minHeight:56},
  drawerSelected:{backgroundColor:"#FFF3C1"},
  drawerRowIcon:{width:38,height:38,backgroundColor:BG,borderRadius:11,
    justifyContent:"center",alignItems:"center"},
  drawerSelectedIcon:{backgroundColor:YELLOW},
  drawerRowTitle:{fontSize:13,fontWeight:"800",color:DARK},
  drawerRowSub:{fontSize:10,color:MUTED,marginTop:2,lineHeight:14},
  drawerFoot:{paddingHorizontal:18,paddingTop:14,paddingBottom:19,
    borderTopWidth:1,borderTopColor:"#E7ECF3"},
  logout:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:13,paddingHorizontal:12,
    borderRadius:12,backgroundColor:"#FFF1F0"},
  logoutText:{fontSize:13,fontWeight:"800",color:"#B42318"},
  drawerFootnote:{fontSize:10,color:MUTED,textAlign:"center",marginTop:10},
});
