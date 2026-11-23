import { useEffect, useRef, useState } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Animated, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius } from '@/constants/theme';
import { getOrderList, subscribeOrderList } from '@/lib/b2b-order-list';
import { useBottomBarScroll } from './BottomBarScrollContext';

// Keep the six primary customer actions visible at all times when expanded.
const TABS: Record<string, {
  label: string; icon: keyof typeof Ionicons.glyphMap; selected: keyof typeof Ionicons.glyphMap;
}> = {
  index: {label:'Ana Sayfa', icon:'home-outline', selected:'home'},
  menu: {label:'Kategoriler', icon:'grid-outline', selected:'grid'},
  discover: {label:'Reels', icon:'play-circle-outline', selected:'play-circle'},
  shortages: {label:'Eksik Listem', icon:'clipboard-outline', selected:'clipboard'},
  orders: {label:'Siparişlerim', icon:'cube-outline', selected:'cube'},
  profile: {label:'Hesabım', icon:'person-outline', selected:'person'},
};

export function TabBar({state, navigation}: BottomTabBarProps) {
  const insets=useSafeAreaInsets();
  const {width}=useWindowDimensions();
  const {collapsed, expandBar}=useBottomBarScroll();
  const [orderCount,setOrderCount]=useState(0);
  const animation=useRef(new Animated.Value(collapsed?1:0)).current;
  const flap=useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    let mounted=true;
    const reload=()=>{void getOrderList().then(items=>{
      if(mounted)setOrderCount(items.length);
    }).catch(()=>undefined)};
    reload();
    const unsubscribe=subscribeOrderList(reload);
    return ()=>{mounted=false;unsubscribe()};
  },[]);
  useEffect(()=>{
    Animated.spring(animation,{
      toValue:collapsed?1:0,
      tension:75,friction:12,useNativeDriver:true,
    }).start();
    Animated.timing(flap,{toValue:collapsed?0:1,duration:300,useNativeDriver:true}).start();
  },[animation,flap,collapsed]);

  const routes=state.routes.map((route,index)=>({route,index}))
    .filter(({route})=>Object.prototype.hasOwnProperty.call(TABS,route.name));
  const onTab=(route: (typeof state.routes)[number], focused:boolean)=>{
    expandBar();
    const event=navigation.emit({
      type:'tabPress',target:route.key,canPreventDefault:true,
    });
    if(!focused&&!event.defaultPrevented)navigation.navigate(route.name);
  };
  const barWidth=Math.min(width-24,520);
  return (
    <View pointerEvents="box-none"
      style={[styles.host,{paddingBottom:Math.max(insets.bottom,Platform.OS==='ios'?8:9)}]}>
      <Animated.View pointerEvents={collapsed?'none':'auto'}
        style={[styles.floatingBar,{width:barWidth,
          opacity:animation.interpolate({inputRange:[0,0.65,1],outputRange:[1,0.12,0]}),
          transform:[{translateY:animation.interpolate({inputRange:[0,1],outputRange:[0,20]})},
            {scale:animation.interpolate({inputRange:[0,1],outputRange:[1,0.87]})}],
        }]}
      >
        <View pointerEvents="none" style={styles.goldAccent}/>
        {routes.map(({route,index})=>{
          const focused=state.index===index;
          const tab=TABS[route.name];
          return <TabButton key={route.key} label={tab.label}
            icon={focused?tab.selected:tab.icon} focused={focused}
            count={route.name==='orders'?orderCount:0}
            onPress={()=>onTab(route,focused)}/>;
        })}
      </Animated.View>
      <Animated.View pointerEvents={collapsed?'auto':'none'}
        style={[styles.parcelDock,{
          opacity:animation.interpolate({inputRange:[0,0.55,1],outputRange:[0,0.15,1]}),
          transform:[{translateY:animation.interpolate({inputRange:[0,1],outputRange:[24,0]})},
            {scale:animation.interpolate({inputRange:[0,1],outputRange:[0.66,1]})}],
        }]}
      >
        <Pressable onPress={expandBar} style={styles.parcelPress} accessibilityRole="button"
          accessibilityLabel="Çalışkan B2B navigasyonunu aç" accessibilityHint="Koli açılır ve alt menü görünür">
          <View style={styles.parcelShadow}/>
          <View style={styles.boxThreeD}>
            <Animated.View style={[styles.boxLid,{
              transform:[{perspective:170},{rotateX:flap.interpolate({
                inputRange:[0,1],outputRange:['-16deg','-65deg']})}],
            }]}/>
            <View style={styles.boxSide}/>
            <View style={styles.boxFront}>
              <View style={styles.boxTape}/>
              <Text style={styles.boxMark}>ÇLK</Text>
            </View>
          </View>
          {orderCount>0?<View style={styles.parcelCounter}><Text style={styles.parcelCounterText}>{orderCount>9?'9+':orderCount}</Text></View>:null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

function TabButton({label,icon,focused,count,onPress}: {
  label:string;icon:keyof typeof Ionicons.glyphMap;focused:boolean;
  count:number;onPress:()=>void;
}) {
  const focus=useRef(new Animated.Value(focused?1:0)).current;
  useEffect(()=>{
    Animated.spring(focus,{toValue:focused?1:0,tension:135,friction:13,useNativeDriver:true}).start();
  },[focus,focused]);
  return <Pressable onPress={onPress} accessibilityRole="tab"
    accessibilityState={{selected:focused}} accessibilityLabel={label+(count?', '+count+' ürün':'')}
    style={styles.tab}>
    <Animated.View style={[styles.iconHalo,{opacity:focus,
      transform:[{scale:focus.interpolate({inputRange:[0,1],outputRange:[0.82,1]})}]}]}/>
    <Animated.View style={[styles.tabIcon,{transform:[{translateY:focus.interpolate({inputRange:[0,1],outputRange:[0,-2]})}]}]}>
      <Ionicons name={icon} size={21} color={focused?'#111111':'#C7CBD2'}/>
      {count>0?<View style={styles.count}><Text style={styles.countText}>{count>9?'9+':count}</Text></View>:null}
    </Animated.View>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
      style={[styles.tabLabel,{color:focused?'#FFCD00':'#E4E4E7',fontWeight:focused?'900':'600'}]}>{label}</Text>
  </Pressable>;
}
const styles=StyleSheet.create({
  host:{
    position:'absolute',bottom:0,left:0,right:0,zIndex:80,
    alignItems:'center',justifyContent:'flex-end',paddingTop:6,
  },
  floatingBar:{
    position:'relative',height:76,borderRadius:34,
    flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    backgroundColor:'#101115',borderWidth:1.2,borderColor:'#756015',
    paddingHorizontal:5,overflow:'hidden',
    shadowColor:'#000',shadowOpacity:0.36,shadowRadius:22,
    shadowOffset:{width:0,height:9},elevation:20,
  },
  goldAccent:{position:'absolute',top:0,left:'18%',right:'18%',height:2,
    borderRadius:2,backgroundColor:'#FFCD00',opacity:0.85},
  tab:{flex:1,minWidth:0,minHeight:58,alignItems:'center',justifyContent:'center',gap:3},
  iconHalo:{position:'absolute',width:39,height:35,top:2,
    backgroundColor:'#FFCD00',borderRadius:17},
  tabIcon:{height:31,width:38,justifyContent:'center',alignItems:'center'},
  tabLabel:{fontSize:9,lineHeight:12,textAlign:'center',letterSpacing:-0.2},
  count:{position:'absolute',top:-6,right:-7,borderRadius:11,
    backgroundColor:'#E11D48',minWidth:18,height:18,paddingHorizontal:3,
    borderWidth:1,borderColor:'#101115',alignItems:'center',justifyContent:'center'},
  countText:{fontSize:9,color:'#FFF',fontWeight:'900'},
  parcelDock:{position:'absolute',right:16,bottom:0,width:70,height:72,
    alignItems:'center',justifyContent:'center'},
  parcelPress:{width:66,height:66,borderRadius:26,backgroundColor:'#121316',
    borderWidth:1.5,borderColor:'#FFC400',alignItems:'center',justifyContent:'center',
    shadowColor:'#FFCD00',shadowOpacity:0.28,shadowRadius:13,
    shadowOffset:{width:0,height:4},elevation:15},
  parcelShadow:{position:'absolute',width:43,height:12,bottom:10,
    borderRadius:999,backgroundColor:'#060606',opacity:0.52},
  boxThreeD:{height:39,width:40,transform:[{perspective:300},{rotateY:'-18deg'},{rotateX:'11deg'}]},
  boxFront:{position:'absolute',bottom:1,left:4,width:35,height:29,
    backgroundColor:'#F2B900',borderRadius:3,borderWidth:1,borderColor:'#FFD54D',
    alignItems:'center',justifyContent:'flex-end',paddingBottom:4,overflow:'hidden'},
  boxSide:{position:'absolute',right:-1,bottom:2,width:9,height:28,
    backgroundColor:'#A76B05',transform:[{skewY:'-24deg'}],borderRadius:2},
  boxLid:{position:'absolute',left:3,top:1,width:38,height:13,
    backgroundColor:'#FFDA58',borderRadius:3,borderWidth:1,borderColor:'#FFF1A4',zIndex:2},
  boxTape:{position:'absolute',top:0,left:15,width:7,height:12,
    backgroundColor:'#FFF1A5',opacity:0.8},
  boxMark:{fontWeight:'900',fontSize:10,color:'#111'},
  parcelCounter:{position:'absolute',top:-3,right:-3,minWidth:19,height:19,
    backgroundColor:'#DC2626',borderRadius:10,alignItems:'center',
    justifyContent:'center',borderWidth:1,borderColor:'#FFF'},
  parcelCounterText:{fontSize:9,fontWeight:'900',color:'#FFF'},
});
