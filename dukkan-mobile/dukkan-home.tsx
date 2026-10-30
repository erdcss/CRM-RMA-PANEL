import React,{useMemo,useState} from "react";
import {Alert,Modal,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions} from "react-native";
import {LinearGradient} from "expo-linear-gradient";
import {
 ArrowRight,ArrowUpRight,BarChart3,BookOpen,Box,Boxes,CalendarDays,ChevronDown,ChevronRight,
 CircleCheck,ClipboardList,Cloud,FileText,House,Landmark,Layers,LogOut,Package,Menu,X,
 PackagePlus,Receipt,RefreshCw,Settings2,ShieldCheck,ShoppingCart,Store,TrendingUp,
 UsersRound,Wallet,CreditCard,HandCoins, type LucideIcon
} from "lucide-react-native";

export type DukkanTab="dashboard"|"invoices"|"products"|"movements"|"parties"|"ledger"|"orders"|
 "banks"|"cash_movements"|"payments"|"instruments"|"report"|"settings";

const navy="#0d2142",ink="#13284b",muted="#7186a3",blue="#1868d0";
const tabIcons:Record<DukkanTab,LucideIcon>={
 dashboard:House,invoices:FileText,products:Package,movements:Layers,parties:UsersRound,
 ledger:BookOpen,orders:ClipboardList,banks:Landmark,cash_movements:Wallet,payments:HandCoins,
 instruments:CreditCard,report:BarChart3,settings:Settings2
};
type StoreChoice={id:number;name:string;role:string};
type HeaderProps={
 company:string;username:string;role:string;online:boolean;
 stores:StoreChoice[];storeId:number;onSwitch:(store:StoreChoice)=>void;onLogout:()=>void;onMenuPress:()=>void;
};
const roleName=(value:string)=>({owner:"Sahip",manager:"Müdür",accountant:"Muhasebe",cashier:"Kasiyer",viewer:"Görüntüleyici"}[value]||value);

export function DukkanMobileHeader({company,username,role,online,stores,storeId,onSwitch,onLogout,onMenuPress}:HeaderProps){
 const [open,setOpen]=useState(false);
 const storeChoices=stores.length>1;
 return <LinearGradient colors={["#0a1b36","#113a73","#0b2146"]} start={{x:0,y:0}} end={{x:1,y:1}} style={ui.header}>
   <View pointerEvents="none" style={ui.headerOrbA}/><View pointerEvents="none" style={ui.headerOrbB}/>
   <View style={ui.headerBrandRow}>
     <Pressable accessibilityRole="button" accessibilityLabel="Sol menüyü aç" onPress={onMenuPress} style={{padding:10,borderWidth:1,borderColor:"#5a85b3",borderRadius:12,marginRight:12}}><Menu color="#ffffff" size={22}/></Pressable>
     <View style={{flex:1}}>
       <Text style={ui.brandLine}>ÇALIŞKAN <Text style={ui.brandBlue}>DÜKKAN</Text></Text>
       <Text style={ui.brandSub}>M O B İ L   ·   İ Ş L E T M E   Y Ö N E T İ M İ</Text>
     </View>
     <ShieldCheck size={19} color="#9ed6ff"/>
   </View>
   <View style={ui.accountPanel}>
     <Pressable accessibilityRole="button" accessibilityLabel="Mağaza hesabı" disabled={!storeChoices}
       onPress={()=>setOpen(v=>!v)} style={ui.accountIdentity}>
       <LinearGradient colors={["#338dd5","#0e407e"]} style={ui.storeBadge}><Store size={25} color="#fff" strokeWidth={2.2}/></LinearGradient>
       <View style={{flex:1,minWidth:0}}>
         <View style={ui.companyLine}><Text style={ui.companyTitle} numberOfLines={1}>{company}</Text>{storeChoices&&<ChevronDown size={17} color="#79cbff"/>}</View>
         <Text style={ui.accountSubtitle} numberOfLines={1}>{username} · {roleName(role)}</Text>
       </View>
     </Pressable>
     <View style={ui.accountActions}>
       <View style={ui.livePill}><View style={[ui.liveDot,{backgroundColor:online?"#8df4d3":"#ffc97a"}]}/><Text style={ui.liveText}>{online?"Bağlantılı":"Bağlantı bekleniyor"}</Text></View>
       <Pressable accessibilityRole="button" accessibilityLabel="Çıkış yap" onPress={onLogout} style={ui.logoutButton}>
         <LogOut size={16} color="#d2e6fc"/><Text style={ui.logoutText}>Çıkış</Text>
       </Pressable>
     </View>
   </View>
   {open&&storeChoices&&<View style={ui.storeSelector}>
     <Text style={ui.storeSelectorTitle}>MAĞAZA DEĞİŞTİR</Text>
     {stores.map(s=><Pressable key={s.id} onPress={()=>{setOpen(false);onSwitch(s);}}
       style={[ui.storeOption,s.id===storeId?ui.storeOptionSelected:null]}>
       <Store size={17} color={s.id===storeId?"#8ad4ff":"#c9ddf7"}/>
       <Text style={ui.storeOptionText} numberOfLines={1}>{s.name}</Text>
       {s.id===storeId&&<CircleCheck size={16} color="#9be6ef"/>}
     </Pressable>)}
   </View>}
 </LinearGradient>;
}

export function DukkanDrawerNavigation({visible,tabs,selected,onChange,onClose}:{
 visible:boolean;tabs:{key:DukkanTab;title:string}[];selected:DukkanTab;
 onChange:(tab:DukkanTab)=>void;onClose:()=>void;
}){
 return <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose} statusBarTranslucent>
  <View style={{flex:1,flexDirection:"row",backgroundColor:"#02061780"}}>
   <View style={{width:"83%",maxWidth:340,backgroundColor:"#ffffff",paddingTop:52,paddingBottom:26,elevation:15}}>
    <View style={{paddingHorizontal:20,paddingBottom:20,borderBottomWidth:1,borderBottomColor:"#e5eaf1",flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
     <View><Text style={{fontWeight:"900",color:"#102744",fontSize:20}}>Çalışkan Dükkan</Text>
      <Text style={{marginTop:4,fontSize:11,color:"#64748b"}}>İşletme yönetimi · Çalışma Alanı</Text></View>
     <Pressable accessibilityRole="button" accessibilityLabel="Menüyü kapat" onPress={onClose} style={{padding:8}}><X color="#334155" size={22}/></Pressable>
    </View>
    <ScrollView contentContainerStyle={{padding:12,paddingBottom:35}}>
     {tabs.map(item=>{
      const Icon=tabIcons[item.key],active=item.key===selected;
      return <Pressable key={item.key} accessibilityRole="button" accessibilityState={{selected:active}}
       onPress={()=>{onChange(item.key);onClose();}}
       style={{flexDirection:"row",alignItems:"center",gap:13,paddingVertical:14,paddingHorizontal:13,marginVertical:2,borderRadius:13,backgroundColor:active?"#164e86":"transparent"}}>
       <Icon size={19} color={active?"#ffffff":"#46617d"}/>
       <Text style={{fontSize:14,fontWeight:active?"800":"600",color:active?"#ffffff":"#253d5b",flex:1}}>{item.title}</Text>
       {active&&<ChevronRight size={15} color="#ffffff"/>}
      </Pressable>;
     })}
    </ScrollView>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Menüyü kapat" onPress={onClose} style={{flex:1}}/>
  </View>
 </Modal>;
}

type NavProps={tabs:{key:DukkanTab;title:string}[];selected:DukkanTab;onChange:(tab:DukkanTab)=>void};
export function DukkanTopNavigation({tabs,selected,onChange}:NavProps){
 return <View style={ui.topNavShell}>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.topNavInner}>
     {tabs.map(({key,title})=>{
       const Icon=tabIcons[key];
       const active=key===selected;
       return <Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:active}}
         onPress={()=>onChange(key)} style={[ui.topTab,active?ui.topTabActive:null]}>
         <Icon size={18} color={active?"#ffffff":"#617997"} strokeWidth={active?2.6:2.1}/>
         <Text style={[ui.topTabText,active?ui.topTabTextActive:null]} numberOfLines={1}>{title}</Text>
       </Pressable>;
     })}
   </ScrollView>
 </View>;
}
type DockProps={selected:DukkanTab;cashier:boolean;onChange:(tab:DukkanTab)=>void};
const dockItems:{key:DukkanTab;label:string}[]=[
 {key:"dashboard",label:"Özet"},{key:"invoices",label:"Faturalar"},
 {key:"products",label:"Ürünler"},{key:"parties",label:"Cariler"},{key:"report",label:"Raporlar"}
];
export function DukkanBottomNavigation({selected,cashier,onChange}:DockProps){
 return <View style={ui.dockOuter}>
   <View style={ui.dockContent}>
     {dockItems.filter(t=>!cashier||!["products","report"].includes(t.key)).map(t=>{
       const active=selected===t.key,Icon=tabIcons[t.key];
       return <Pressable key={t.key} accessibilityRole="tab" accessibilityLabel={t.label}
         accessibilityState={{selected:active}} onPress={()=>onChange(t.key)}
         style={[ui.dockItem,active?ui.dockActive:null]}>
         <Icon size={21} strokeWidth={active?2.7:2.1} color={active?blue:"#7189aa"}/>
         <Text style={[ui.dockLabel,active?ui.dockLabelActive:null]}>{t.label}</Text>
       </Pressable>;
     })}
   </View>
 </View>;
}

type DashboardSummary={
 sales?:number;purchases?:number;receivables?:number;payables?:number;cash?:number;
 bank?:number;stockCost?:number;products?:number;
};
type OverviewProps={
 summary:DashboardSummary;cashier:boolean;canManage:boolean;onQuickAction:(kind:string)=>void;
 onNavigate:(tab:DukkanTab)=>void;onRefresh:()=>void;
};
const fullMoney=(cents:number|undefined)=>((Number(cents)||0)/100).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
type QuickAction={kind:string;label:string;description:string;icon:LucideIcon;pastel:string;ink:string;iconBg:string};
const quickActions:QuickAction[]=[
 {kind:"invoice",label:"Satış",description:"Yeni satış ekle",icon:ShoppingCart,pastel:"#d9f6ff",ink:"#0e467f",iconBg:"#b5edfa"},
 {kind:"product",label:"Yeni Ürün",description:"Ürün oluştur",icon:PackagePlus,pastel:"#e1ecff",ink:"#194887",iconBg:"#c7dcff"},
 {kind:"party",label:"Cari",description:"Yeni cari ekle",icon:UsersRound,pastel:"#ddf9eb",ink:"#106744",iconBg:"#bdf3d8"},
 {kind:"payment",label:"Tahsilat",description:"Tahsilat gir",icon:CreditCard,pastel:"#fff0d9",ink:"#92410a",iconBg:"#ffdfb6"}
];
type Metric={label:string;key:keyof DashboardSummary;icon:LucideIcon;accent:string;soft:string;route:DukkanTab;count?:boolean};
const metrics:Metric[]=[
 {label:"Net Satış",key:"sales",icon:TrendingUp,accent:"#159269",soft:"#e1fbef",route:"invoices"},
 {label:"Net Alış",key:"purchases",icon:ShoppingCart,accent:"#de4163",soft:"#ffe9ef",route:"invoices"},
 {label:"Alacaklar",key:"receivables",icon:Wallet,accent:"#e7950a",soft:"#fff3db",route:"parties"},
 {label:"Borçlar",key:"payables",icon:CreditCard,accent:"#7c45cf",soft:"#f0e7ff",route:"parties"},
 {label:"Kasa",key:"cash",icon:Wallet,accent:"#2082df",soft:"#e5f2ff",route:"payments"},
 {label:"Banka",key:"bank",icon:Landmark,accent:"#2078d7",soft:"#e4f2ff",route:"banks"},
 {label:"Stok Değeri",key:"stockCost",icon:Box,accent:"#7642d7",soft:"#eee7ff",route:"products"},
 {label:"Ürün Sayısı",key:"products",icon:BarChart3,accent:"#089eaa",soft:"#dffafb",route:"products",count:true}
];

export function DukkanDashboardOverview({summary,cashier,canManage,onQuickAction,onNavigate,onRefresh}:OverviewProps){
 const {width}=useWindowDimensions();
 const gridCount=width>=750?4:2;
 const currentDate=useMemo(()=>new Date().toLocaleDateString("tr-TR",{day:"numeric",month:"short",year:"numeric"}),[]);
 const allowedQuick=quickActions.filter(a=>(!cashier||!["product","payment"].includes(a.kind))&&(a.kind!=="product"||canManage));
 const quickWidth=gridCount===4?"23%":"47%";
 return <View>
   <View style={ui.overviewHeading}>
     <View style={{flex:1,minWidth:165}}>
       <Text style={ui.eyebrow}>MERKEZİ İŞLETME PANELİ</Text>
       <Text style={ui.overviewTitle}>Genel Bakış</Text>
       <Text style={ui.overviewCaption}>Güncel mağaza bilgileri ve hızlı işlemler</Text>
     </View>
     <Pressable accessibilityRole="button" accessibilityLabel="Verileri yenile" onPress={onRefresh} style={ui.datePanel}>
       <CalendarDays size={20} color="#3c638e"/>
       <View><Text style={ui.dateTitle}>Bugün</Text><Text style={ui.dateValue}>{currentDate}</Text></View>
       <RefreshCw size={14} color="#7086a3"/>
     </Pressable>
   </View>
   <LinearGradient colors={["#0a294c","#154f91","#0b2b55"]} start={{x:0,y:0}} end={{x:1,y:1}} style={ui.actionHero}>
     <View pointerEvents="none" style={ui.heroOrbOne}/><View pointerEvents="none" style={ui.heroOrbTwo}/>
     <View style={ui.actionTitleRow}>
       <View style={ui.boltCircle}><TrendingUp size={22} color="#fff" strokeWidth={2.5}/></View>
       <View style={{flex:1}}><Text style={ui.heroTitle}>Bugün ne yapalım?</Text>
         <Text style={ui.heroSubtitle}>Satış, stok ve carilerinizi tek yerden yönetin.</Text>
       </View>
     </View>
     <View style={ui.actionGrid}>
       {allowedQuick.map(item=>{
         const Icon=item.icon;
         return <Pressable key={item.kind} accessibilityRole="button" accessibilityLabel={item.label}
           onPress={()=>onQuickAction(item.kind)} style={[ui.actionCard,{width:quickWidth,backgroundColor:item.pastel}]}>
           <View style={ui.actionTopRow}>
             <View style={[ui.actionIcon,{backgroundColor:item.iconBg}]}><Icon size={22} color={item.ink} strokeWidth={2.3}/></View>
             <ChevronRight size={18} color={item.ink}/>
           </View>
           <Text style={[ui.actionLabel,{color:item.ink}]}>{"+ "+item.label}</Text>
           <Text style={[ui.actionDescription,{color:item.ink}]}>{item.description}</Text>
         </Pressable>;
       })}
     </View>
   </LinearGradient>
   {!cashier&&<>
     <View style={ui.metricSectionRow}>
       <View><Text style={ui.metricSectionTitle}>Finansal Özet</Text><Text style={ui.metricSectionCaption}>İşletmenizin anlık rakamları</Text></View>
       <Pressable onPress={()=>onNavigate("report")} accessibilityRole="button" accessibilityLabel="Tüm raporları aç" style={ui.viewAll}>
         <Text style={ui.viewAllText}>Tümü</Text><ArrowUpRight size={16} color={blue}/>
       </Pressable>
     </View>
     <View style={ui.metricGrid}>
       {metrics.map(item=>{
         const Icon=item.icon, amount=item.count?String(Number(summary.products)||0):fullMoney(summary[item.key]);
         return <Pressable key={item.key} onPress={()=>onNavigate(item.route)} accessibilityRole="button"
           accessibilityLabel={item.label+": "+amount} style={ui.metricCard}>
           <View style={ui.metricCardTop}>
             <View style={[ui.metricCircle,{backgroundColor:item.soft}]}><Icon size={20} strokeWidth={2.4} color={item.accent}/></View>
             <View style={[ui.metricChevron,{backgroundColor:item.soft}]}><ChevronRight size={16} color={item.accent}/></View>
           </View>
           <Text style={ui.metricLabel} numberOfLines={1}>{item.label}</Text>
           <Text style={ui.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{amount}</Text>
         </Pressable>;
       })}
     </View>
   </>}
 </View>;
}
const ui=StyleSheet.create({
 header:{paddingTop:17,paddingBottom:19,paddingHorizontal:17,borderBottomLeftRadius:27,borderBottomRightRadius:27,overflow:"hidden"},
 headerOrbA:{position:"absolute",width:210,height:210,borderRadius:105,backgroundColor:"#1a64ab66",right:-65,top:-105},
 headerOrbB:{position:"absolute",width:185,height:185,borderRadius:93,backgroundColor:"#244e9966",right:130,bottom:-140},
 headerBrandRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:16,paddingHorizontal:3},
 brandLine:{fontWeight:"900",fontSize:20,letterSpacing:0.8,color:"#ffffff"},
 brandBlue:{color:"#4edaff"},brandSub:{marginTop:4,color:"#bdd2ed",fontSize:9,fontWeight:"800",letterSpacing:1.3},
 accountPanel:{backgroundColor:"#0d2a4fbf",borderColor:"#38639580",borderWidth:1,borderRadius:21,paddingHorizontal:12,paddingVertical:13,flexDirection:"row",alignItems:"center",gap:8},
 accountIdentity:{flexDirection:"row",gap:10,alignItems:"center",flex:1,minWidth:0},
 storeBadge:{height:45,width:45,borderRadius:14,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#82bdfa60"},
 companyLine:{flexDirection:"row",alignItems:"center",gap:5},
 companyTitle:{fontWeight:"900",fontSize:15,color:"#fff",flexShrink:1},
 accountSubtitle:{color:"#c1d4ef",fontSize:11,marginTop:5,fontWeight:"500"},
 accountActions:{alignItems:"flex-end",gap:8},
 livePill:{flexDirection:"row",alignItems:"center",gap:5,borderRadius:30,paddingHorizontal:9,paddingVertical:8,backgroundColor:"#083d58",borderWidth:1,borderColor:"#328ba7"},
 liveDot:{width:7,height:7,borderRadius:7},
 liveText:{fontSize:10,color:"#a4f6de",fontWeight:"900"},
 logoutButton:{flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:6},
 logoutText:{color:"#d8e7fa",fontSize:10,fontWeight:"700"},
 storeSelector:{backgroundColor:"#0d325d",padding:12,borderRadius:16,borderColor:"#2c70aa",borderWidth:1,marginTop:9},
 storeSelectorTitle:{fontSize:10,letterSpacing:1.5,fontWeight:"900",color:"#b5ddfb",marginBottom:9},
 storeOption:{paddingHorizontal:12,paddingVertical:12,flexDirection:"row",alignItems:"center",gap:10,borderRadius:10},
 storeOptionSelected:{backgroundColor:"#20558d"},
 storeOptionText:{flex:1,color:"#f5faff",fontSize:13,fontWeight:"800"},
 topNavShell:{backgroundColor:"#ffffff",borderBottomWidth:1,borderBottomColor:"#e4eefa",paddingTop:9,paddingBottom:10},
 topNavInner:{paddingHorizontal:15,gap:8},
 topTab:{flexDirection:"row",alignItems:"center",gap:7,backgroundColor:"#f5f8fd",borderWidth:1,borderColor:"#e7edf7",paddingHorizontal:14,paddingVertical:12,borderRadius:15,minHeight:45},
 topTabActive:{backgroundColor:"#176bd8",borderColor:"#176bd8",shadowColor:blue,shadowOpacity:0.15,shadowOffset:{width:0,height:3},shadowRadius:5,elevation:2},
 topTabText:{color:"#49607f",fontSize:12,fontWeight:"800"},
 topTabTextActive:{color:"#fff"},
 overviewHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:19,flexWrap:"wrap"},
 eyebrow:{fontSize:10,color:"#6283b0",fontWeight:"900",letterSpacing:1.3},
 overviewTitle:{fontSize:27,color:ink,fontWeight:"900",letterSpacing:-0.6,marginTop:8},
 overviewCaption:{fontSize:12,color:muted,marginTop:5,lineHeight:18},
 datePanel:{flexDirection:"row",gap:8,alignItems:"center",paddingHorizontal:12,paddingVertical:10,backgroundColor:"#ffffff",borderWidth:1,borderColor:"#e1eaf8",borderRadius:16,shadowColor:"#234869",shadowOpacity:0.025,shadowRadius:10,elevation:1},
 dateTitle:{fontSize:10,fontWeight:"800",color:"#6682a3"},
 dateValue:{fontSize:11,fontWeight:"900",color:ink,marginTop:2},
 actionHero:{borderRadius:23,padding:17,overflow:"hidden",shadowColor:navy,shadowOpacity:0.15,shadowRadius:16,shadowOffset:{width:0,height:8},elevation:4},
 heroOrbOne:{position:"absolute",height:235,width:235,right:-105,top:-80,borderRadius:120,backgroundColor:"#3b8cee40"},
 heroOrbTwo:{position:"absolute",height:240,width:240,right:65,bottom:-160,borderRadius:120,backgroundColor:"#195da75c"},
 actionTitleRow:{flexDirection:"row",alignItems:"center",gap:10,marginBottom:17},
 boltCircle:{height:43,width:43,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#1767ae",borderColor:"#40aaf5",borderWidth:1},
 heroTitle:{fontSize:21,fontWeight:"900",color:"#ffffff",letterSpacing:-0.5},
 heroSubtitle:{fontSize:11,color:"#c9d9eb",marginTop:6,lineHeight:17},
 actionGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:8},
 actionCard:{borderRadius:18,padding:13,minHeight:119,justifyContent:"space-between",flexGrow:1},
 actionTopRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
 actionIcon:{width:39,height:39,borderRadius:20,alignItems:"center",justifyContent:"center"},
 actionLabel:{fontSize:14,fontWeight:"900",marginTop:10},
 actionDescription:{fontSize:10,fontWeight:"600",opacity:0.8,marginTop:2},
 metricSectionRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:25,marginBottom:12},
 metricSectionTitle:{fontSize:17,fontWeight:"900",color:ink},
 metricSectionCaption:{fontSize:11,color:"#7d8fa7",marginTop:4},
 viewAll:{flexDirection:"row",alignItems:"center",gap:3,paddingVertical:6,paddingHorizontal:8},
 viewAllText:{fontSize:12,fontWeight:"900",color:blue},
 metricGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:10},
 metricCard:{width:"48%",backgroundColor:"#ffffff",borderRadius:19,borderWidth:1,borderColor:"#e1eaf7",minHeight:128,padding:13,shadowColor:"#1d3d65",shadowOpacity:0.03,shadowOffset:{width:0,height:4},shadowRadius:7,elevation:1},
 metricCardTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:10},
 metricCircle:{width:39,height:39,borderRadius:20,justifyContent:"center",alignItems:"center"},
 metricChevron:{height:25,width:25,borderRadius:13,alignItems:"center",justifyContent:"center"},
 metricLabel:{color:"#7286a1",fontSize:11,fontWeight:"800"},
 metricValue:{fontSize:17,fontWeight:"900",color:ink,letterSpacing:-0.3,marginTop:5},
 dockOuter:{backgroundColor:"#ffffff",borderTopWidth:1,borderTopColor:"#e1e9f5",paddingHorizontal:8,paddingVertical:8},
 dockContent:{flexDirection:"row",alignItems:"center",justifyContent:"space-around",gap:4},
 dockItem:{flex:1,borderRadius:17,alignItems:"center",justifyContent:"center",paddingVertical:8,gap:5},
 dockActive:{backgroundColor:"#e5f0ff"},
 dockLabel:{fontSize:10,fontWeight:"800",color:"#7a8da7"},
 dockLabelActive:{color:blue}
});
