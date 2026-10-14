import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAppearance } from '@/contexts/AppearanceContext';
import { rmaApi, type B2BNotification } from '@/lib/api';
import { registerB2BPush } from '@/lib/push';
import { appAlert } from '@/lib/appAlert';

export default function NotificationsScreen() {
  const router=useRouter();
  const {palette}=useAppearance();
  const [items,setItems]=useState<B2BNotification[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [pushRegistering,setPushRegistering]=useState(false);
  const load=useCallback(async()=>{
    try{setItems(await rmaApi.listB2BNotifications());}
    catch(error){appAlert('Bildirimler alınamadı', error instanceof Error?error.message:'Tekrar deneyin');}
    finally{setLoading(false);}
  },[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  const refresh=async()=>{setRefreshing(true);try{await load();}finally{setRefreshing(false);}};
  const open=async(item:B2BNotification)=>{
    if(!item.read_at){
      void rmaApi.markB2BNotificationRead(item.id).then(()=>setItems(prev=>prev.map(n=>n.id===item.id?{...n,read_at:new Date().toISOString()}:n))).catch(()=>undefined);
    }
    if(item.event_key==='invoice_issued')router.push({pathname:'/account/[section]',params:{section:'invoices'}} as never);
    else if(item.event_key==='order_created')router.push('/my-orders' as never);
    else if(item.event_key==='return_approved')router.push({pathname:'/account/[section]',params:{section:'returns'}} as never);
  };
  async function register(){
    setPushRegistering(true);
    try{
      const ok=await registerB2BPush();
      appAlert(ok?'Bildirim izni etkin':'Bildirim izni açılamadı',
        ok?'Bu cihaz B2B bildirimleri için kaydedildi.':'Cihaz ayarlarından bildirim iznini açın veya Expo yapılandırmasını kontrol edin.');
    }finally{setPushRegistering(false);}
  }
  const unread=items.filter(item=>!item.read_at).length;
  return <Screen style={{backgroundColor:palette.background}}>
    <View style={styles.header}>
      <Pressable onPress={()=>router.back()} style={styles.back} accessibilityLabel="Geri dön">
        <Ionicons name="chevron-back" color={palette.text} size={25}/>
      </Pressable>
      <View style={{flex:1}}>
        <Text style={[styles.heading,{color:palette.text}]}>Bildirimlerim</Text>
        <Text style={{color:palette.textSecondary,fontSize:12}}>{unread} okunmamış bildirim</Text>
      </View>
      <Pressable onPress={()=>void register()} disabled={pushRegistering} accessibilityLabel="Bildirim iznini etkinleştir" style={styles.back}>
        <Ionicons name="notifications-outline" size={24} color={palette.accent}/>
      </Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh()} tintColor={palette.accent}/>}>
      {loading ? <ActivityIndicator color={palette.accent} style={{marginTop:50}}/> :
       !items.length ? <View style={styles.empty}>
         <Ionicons name="notifications-off-outline" size={40} color={palette.muted}/>
         <Text style={{color:palette.text,fontSize:17,fontWeight:'800',marginTop:13}}>Henüz bildirim yok</Text>
         <Text style={{color:palette.textSecondary,fontSize:13,marginTop:7,textAlign:'center'}}>Sipariş, fatura, iade ve önemli duyurularınız burada listelenir.</Text>
       </View> : items.map(item=><Pressable key={item.id}
          onPress={()=>void open(item)}
          style={[styles.card,{borderColor:item.read_at?palette.border:palette.accent,backgroundColor:palette.surface}]}>
          <View style={[styles.icon,{backgroundColor:palette.surfaceSecondary}]}>
            <Ionicons name={item.event_key==='invoice_issued'?'document-text-outline':
               item.event_key==='order_created'?'bag-handle-outline':
               item.event_key==='return_approved'?'return-down-back-outline':'notifications-outline'}
              color={palette.text} size={23}/>
          </View>
          <View style={{flex:1,minWidth:0}}>
            <Text style={{color:palette.text,fontWeight:item.read_at?'600':'800',fontSize:14}}>{item.title}</Text>
            <Text style={{color:palette.textSecondary,fontSize:13,lineHeight:19,marginTop:4}}>{item.body}</Text>
            <Text style={{color:palette.muted,fontSize:11,marginTop:8}}>{new Date(item.created_at).toLocaleString('tr-TR')}</Text>
          </View>
          {!item.read_at?<View style={{height:8,width:8,borderRadius:4,backgroundColor:palette.accent,marginTop:8}}/>:null}
       </Pressable>)}
    </ScrollView>
  </Screen>;
}
const styles=StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:12,minHeight:65},
  back:{width:43,height:43,alignItems:'center',justifyContent:'center'},
  heading:{fontSize:22,fontWeight:'900'},
  content:{paddingHorizontal:16,paddingTop:12,paddingBottom:110,gap:11},
  empty:{alignItems:'center',paddingHorizontal:30,paddingVertical:100},
  card:{borderWidth:1,borderRadius:15,padding:13,flexDirection:'row',gap:12},
  icon:{width:43,height:43,borderRadius:12,alignItems:'center',justifyContent:'center'},
});
