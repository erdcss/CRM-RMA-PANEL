import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppearance } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { rmaApi } from '@/lib/api';
import { appAlert } from '@/lib/appAlert';

export default function MarketplaceQuoteRequest(){
  const {slug,productId}=useLocalSearchParams<{slug:string;productId?:string}>();
  const router=useRouter();
  const {palette}=useAppearance();
  const {session}=useAuth();
  const [boxes,setBoxes]=useState('1');
  const [details,setDetails]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const submit=async()=>{
    if(busy)return;
    if(!session){router.push('/login');return;}
    const count=Number(boxes);
    if(!Number.isSafeInteger(count)||count<1||count>100000){setError('Koli adedi 1 ile 100.000 arasında olmalı.');return;}
    setBusy(true);setError('');
    try {
      const threads=await rmaApi.listMarketplaceConversations();
      let thread=threads.find(item=>item.slug===slug);
      if(!thread){
        const started=await rmaApi.startMarketplaceConversation(String(slug),'Teklif talebi görüşmesi başlatıldı.');
        thread={id:started.id,slug:String(slug),company_name:'',buyer_user_id:Number(session.user?.id)||0,latest_message:''};
      }
      await rmaApi.requestMarketplaceQuote(Number(thread.id),count,details.trim(),productId?Number(productId):undefined);
      appAlert('Teklif talebi gönderildi','Tedarikçi teklifinizi uygulama panelinden yanıtlayabilir.',undefined,'success');
      router.replace({pathname:'/marketplace/chat/[slug]',params:{slug:String(slug)}} as never);
    }catch(e){setError(e instanceof Error?e.message:'Teklif gönderilemedi.');}
    finally{setBusy(false);}
  };
  return <KeyboardAvoidingView style={{flex:1,backgroundColor:palette.background}} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView contentContainerStyle={styles.body}>
      <Pressable style={styles.back} onPress={()=>router.back()}><Ionicons name="chevron-back" color={palette.text} size={21}/><Text style={{color:palette.text,fontWeight:'800'}}>Mağazaya dön</Text></Pressable>
      <Text style={[styles.heading,{color:palette.text}]}>Teklif İste</Text>
      <Text style={[styles.sub,{color:palette.textSecondary}]}>Onaylı satıcıya koli miktarını ve teklif ayrıntılarını gönderin.</Text>
      <View style={[styles.panel,{backgroundColor:palette.surface,borderColor:palette.border}]}>
        <Text style={[styles.label,{color:palette.text}]}>Koli adedi</Text>
        <TextInput value={boxes} onChangeText={setBoxes} keyboardType="number-pad" style={[styles.input,{color:palette.text,borderColor:palette.border}]}/>
        <Text style={[styles.label,{color:palette.text}]}>Teklif notu (isteğe bağlı)</Text>
        <TextInput value={details} multiline maxLength={2000} onChangeText={setDetails}
          placeholder="Miktar, sevkiyat veya diğer talepleriniz…" placeholderTextColor={palette.textSecondary}
          style={[styles.input,styles.textArea,{color:palette.text,borderColor:palette.border}]}/>
        {error?<Text style={{color:'#B91C1C'}}>{error}</Text>:null}
        <Pressable disabled={busy} onPress={()=>void submit()} style={[styles.action,busy&&{opacity:.5}]}>
          <Text style={styles.actionText}>{busy?'Gönderiliyor…':'Teklifi Gönder'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles=StyleSheet.create({
  body:{padding:17,gap:13},back:{flexDirection:'row',gap:4,alignItems:'center',paddingVertical:10},
  heading:{fontSize:24,fontWeight:'900'},sub:{fontSize:13,lineHeight:20},panel:{padding:17,gap:12,borderWidth:1,borderRadius:16,marginTop:10},
  label:{fontSize:13,fontWeight:'800'},input:{borderWidth:1,borderRadius:11,padding:12,fontSize:15},textArea:{height:105,textAlignVertical:'top'},
  action:{padding:15,backgroundColor:'#FFCD00',borderRadius:12,alignItems:'center'},actionText:{fontWeight:'900',color:'#111827'},
});
