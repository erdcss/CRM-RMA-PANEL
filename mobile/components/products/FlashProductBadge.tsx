import {useEffect,useState} from 'react';
import {AppState,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

type Props={size:number;right?:number;endAt?:string|null};

/** Shared circular flash artwork; never changes the dimensions of the gallery. */
export function FlashProductBadge({size,right=3,endAt}:Props){
  const deadline=endAt?Date.parse(endAt):null;
  const [expiredDeadline,setExpiredDeadline]=useState<number|null>(null);
  useEffect(()=>{
    if(deadline===null||!Number.isFinite(deadline))return;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const check=()=>{
      if(timer!==undefined)clearTimeout(timer);
      const remaining=deadline-Date.now();
      if(remaining<=0)setExpiredDeadline(deadline);
      else timer=setTimeout(check,Math.min(remaining+1,2_147_483_647));
    };
    check();
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')check();});
    return ()=>{if(timer!==undefined)clearTimeout(timer);subscription.remove();};
  },[deadline]);
  if(deadline!==null&&(!Number.isFinite(deadline)||deadline<=Date.now()||expiredDeadline===deadline))return null;
  const fontSize=Math.max(7,Math.round(size*0.19));
  const lineHeight=fontSize+1;
  return <View pointerEvents="none" accessibilityLabel="Flash Ürün"
    style={[styles.flashBadge,{right,width:size,height:size,borderRadius:size/2,marginTop:-size/2}]}>
    <Ionicons name="flash" size={Math.round(size*0.38)} color="#171717"/>
    <Text style={[styles.flashBadgeText,{fontSize,lineHeight}]} numberOfLines={1}>Flash</Text>
    <Text style={[styles.flashBadgeText,{fontSize,lineHeight}]} numberOfLines={1}>Ürün</Text>
  </View>;
}
const styles=StyleSheet.create({
  flashBadge:{position:'absolute',right:3,top:'50%',backgroundColor:'#FFCD00',borderWidth:1.5,borderColor:'#FFF0A6',
    alignItems:'center',justifyContent:'center',shadowColor:'#000000',shadowOpacity:0.18,shadowRadius:2,
    shadowOffset:{width:0,height:1},elevation:2,zIndex:2},
  flashBadgeText:{fontWeight:'400',color:'#171717',includeFontPadding:false},
});
