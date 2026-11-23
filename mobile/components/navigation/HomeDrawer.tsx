import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMobileBranding } from '@/lib/branding';
import { useAppearance } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import Constants from 'expo-constants';

type DrawerItem = { label:string; icon:keyof typeof Ionicons.glyphMap; route:string };
const primary:DrawerItem[] = [
  {label:'Ana Sayfa',icon:'home-outline',route:'/(tabs)'},
  {label:'Kategoriler',icon:'grid-outline',route:'/(tabs)/menu'},
  {label:'Reels',icon:'play-circle-outline',route:'/(tabs)/discover'},
  {label:'Eksik Listem',icon:'clipboard-outline',route:'/(tabs)/shortages'},
  {label:'Siparişlerim',icon:'cube-outline',route:'/(tabs)/orders'},
  {label:'Hesabım',icon:'person-circle-outline',route:'/(tabs)/profile'},
];
const secondary:DrawerItem[] = [
  {label:'Kampanyalar',icon:'pricetag-outline',route:'/campaigns'},
  {label:'Sipariş Geçmişi',icon:'receipt-outline',route:'/my-orders'},
  {label:'Bildirimler',icon:'notifications-outline',route:'/notifications'},
  {label:'Ayarlar',icon:'settings-outline',route:'/settings'},
];

export function HomeDrawer({visible,onClose}: {visible:boolean;onClose:()=>void}) {
  const {width}=useWindowDimensions();
  const insets=useSafeAreaInsets();
  const router=useRouter();
  const branding=useMobileBranding();
  const {palette}=useAppearance();
  const {user}=useAuth();
  const progress=useRef(new Animated.Value(0)).current;
  const drawerWidth=Math.min(326,Math.max(256,width*0.83));
  const isSeller=user?.role==='b2b_seller'||user?.role==='super_admin';
  const tools=useMemo(()=>isSeller
    ? [...secondary,{label:'AI ile Ürün Ekle',icon:'sparkles-outline',route:'/ai-product-studio'} as DrawerItem]
    : secondary,[isSeller]);
  useEffect(()=>{
    Animated.spring(progress,{toValue:visible?1:0,
      tension:82,friction:13,useNativeDriver:true}).start();
  },[visible,progress]);
  const go=(to:string)=>{
    onClose();
    router.push(to as never);
  };
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFillObject,styles.overlayHost]} pointerEvents="box-none">
      <Animated.View style={[styles.scrim,{opacity:progress.interpolate({
        inputRange:[0,1],outputRange:[0,0.77]})}]}/>
      <Pressable accessibilityLabel="Menüyü kapat" onPress={onClose}
        style={StyleSheet.absoluteFillObject}/>
      <Animated.View style={[styles.drawer,{width:drawerWidth,
        paddingTop:Math.max(insets.top,24)+12,
        paddingBottom:Math.max(insets.bottom,14)+12,
        transform:[{translateX:progress.interpolate({
          inputRange:[0,1],outputRange:[-drawerWidth-20,0]})}],
      }]}>
        <View style={styles.drawerHeader}>
          <View style={styles.brandSpace}>
            {branding.b2b_mobile_logo
              ? <Image source={{uri:branding.b2b_mobile_logo}} style={styles.brand}
                  contentFit="contain" cachePolicy="none" accessibilityLabel="Çalışkan B2B logosu"/>
              : <Text style={styles.brandFallback}>ÇALIŞKAN <Text style={{color:'#FFCD00'}}>B2B</Text></Text>}
          </View>
          <Pressable onPress={onClose} style={styles.close}
            accessibilityRole="button" accessibilityLabel="Menüyü kapat">
            <Ionicons name="close" size={20} color="#FFF"/>
          </Pressable>
        </View>
        <View style={styles.goldRule}/>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuContent}>
          <Text style={styles.groupTitle}>HIZLI ERİŞİM</Text>
          {primary.map(item=><DrawerRow key={item.route} {...item} onPress={()=>go(item.route)}/>)}
          <View style={styles.separator}/>
          <Text style={styles.groupTitle}>İŞLEMLER</Text>
          {tools.map(item=><DrawerRow key={item.route} {...item} onPress={()=>go(item.route)}/>)}
        </ScrollView>
        <View style={styles.drawerFooter}>
          <View style={styles.footerIcon}><Ionicons name="cube-outline" color="#111" size={17}/></View>
          <View style={{flex:1}}>
            <Text style={styles.footerName}>ÇALIŞKAN B2B</Text>
            <Text style={styles.footerVersion}>iOS · v{Constants.expoConfig?.version||'—'}</Text>
          </View>
          <Ionicons name="shield-checkmark-outline" size={18} color="#FFCD00"/>
        </View>
      </Animated.View>
    </View>
  );
}
function DrawerRow({label,icon,onPress}: DrawerItem & {onPress:()=>void}) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
    style={({pressed})=>[styles.menuRow,pressed&&styles.menuRowPressed]}>
    <View style={styles.menuIcon}><Ionicons name={icon} size={20} color="#FFCD00"/></View>
    <Text style={styles.menuText} numberOfLines={1}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color="#A9A9AC"/>
  </Pressable>;
}
const styles=StyleSheet.create({
  overlayHost:{zIndex:200,elevation:30,flexDirection:'row'},
  scrim:{...StyleSheet.absoluteFillObject,backgroundColor:'#000'},
  drawer:{height:'100%',backgroundColor:'#111215',borderRightWidth:1,
    borderRightColor:'#AA8614',shadowColor:'#000',shadowOpacity:0.4,shadowRadius:24,
    shadowOffset:{width:5,height:0},elevation:40},
  drawerHeader:{paddingHorizontal:17,flexDirection:'row',alignItems:'center',
    justifyContent:'space-between',gap:8,height:68},
  brandSpace:{flex:1,justifyContent:'center',height:54},
  brand:{width:'100%',height:54},
  brandFallback:{color:'#FFF',fontSize:17,fontWeight:'900'},
  close:{width:38,height:38,backgroundColor:'#2A2B30',borderRadius:13,
    alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#48484C'},
  goldRule:{height:1,backgroundColor:'#C8A01C',opacity:0.7,marginHorizontal:18,marginVertical:9},
  menuContent:{paddingHorizontal:15,paddingTop:6,paddingBottom:18},
  groupTitle:{color:'#F6C829',fontSize:10,letterSpacing:1.7,
    fontWeight:'900',marginTop:14,marginBottom:10,marginLeft:10},
  menuRow:{minHeight:51,borderRadius:16,flexDirection:'row',
    alignItems:'center',gap:11,paddingHorizontal:10,marginBottom:5},
  menuRowPressed:{backgroundColor:'#2A2A2A'},
  menuIcon:{width:36,height:36,borderRadius:12,backgroundColor:'#28251A',
    alignItems:'center',justifyContent:'center'},
  menuText:{color:'#F5F5F6',fontSize:14,fontWeight:'700',flex:1},
  separator:{height:1,backgroundColor:'#2F3034',marginTop:12,marginHorizontal:10},
  drawerFooter:{marginHorizontal:15,marginTop:8,borderRadius:18,
    padding:12,minHeight:62,backgroundColor:'#222326',borderColor:'#514519',borderWidth:1,
    flexDirection:'row',alignItems:'center',gap:11},
  footerIcon:{width:34,height:34,borderRadius:11,backgroundColor:'#FFCD00',
    alignItems:'center',justifyContent:'center'},
  footerName:{fontSize:11,color:'#FFF',fontWeight:'900',letterSpacing:0.8},
  footerVersion:{fontSize:10,color:'#B1B4BC',marginTop:4},
});
