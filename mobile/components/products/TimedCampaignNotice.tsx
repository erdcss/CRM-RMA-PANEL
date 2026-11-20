import { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function timedCampaignRemaining(endAt: string, now: number) {
  const remaining = Math.max(0, Date.parse(endAt) - now);
  if (!Number.isFinite(remaining) || !remaining) return 'Süre doldu';
  const total = Math.floor(remaining / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor(total % 86400 / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  const seconds = total % 60;
  const pad = (n:number) => String(n).padStart(2, '0');
  return (days ? days + 'g ' : '') + pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
}

export function TimedCampaignNotice({
  endAt, title, stock, unitsPerBox, compact = false, onExpire,
}:{
  endAt?:string|null;title?:string|null;stock?:number|null;
  unitsPerBox?:number|null;compact?:boolean;onExpire?:()=>void;
}) {
  const [now,setNow]=useState(Date.now());
  const fired=useRef(false);
  useEffect(()=>{
    fired.current=false;
    if(!endAt)return;
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return ()=>clearInterval(timer);
  },[endAt]);
  const until=endAt?Date.parse(endAt):0;
  const expired=Number.isFinite(until)&&until>0&&now>=until;
  useEffect(()=>{
    if(!expired||fired.current)return;
    fired.current=true;
    onExpire?.();
  },[expired,onExpire]);
  if(!endAt||!Number.isFinite(until)||expired)return null;
  const boxes=Math.floor(Math.max(0,Number(stock)||0)/Math.max(1,Number(unitsPerBox)||1));
  return <View accessibilityLabel="Süreli kampanya" style={{
    marginTop:compact?7:11,paddingHorizontal:compact?9:13,paddingVertical:compact?8:12,
    backgroundColor:'#111827',borderRadius:11,borderWidth:1,borderColor:'#EAB308',
  }}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:5}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:5,flexShrink:1}}>
        <Ionicons name="flash" size={13} color="#FFCD00"/>
        <Text numberOfLines={2} style={{fontSize:compact?10:12,fontWeight:'900',color:'#FFCD00',flexShrink:1}}>
          {title||'SÜRELİ FIRSAT'}
        </Text>
      </View>
      <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
        <Ionicons name="time-outline" size={13} color="#FFCD00"/>
        <Text style={{fontSize:compact?11:14,color:'#FFCD00',fontWeight:'900',fontVariant:['tabular-nums']}}>
          {timedCampaignRemaining(endAt,now)}
        </Text>
      </View>
    </View>
    <View style={{marginTop:4,flexDirection:'row',gap:5,alignItems:'center'}}>
      <Ionicons name="cube-outline" size={13} color="#FFFFFF"/>
      <Text style={{color:'#FFFFFF',fontWeight:'700',fontSize:compact?10:12}}>
        Kalan stok: {boxes} koli
      </Text>
    </View>
  </View>;
}
