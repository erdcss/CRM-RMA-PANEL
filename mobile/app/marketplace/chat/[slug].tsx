import { useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAppearance } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { rmaApi, type MarketplaceConversation, type MarketplaceMessage } from '@/lib/api';

export default function SellerChat() {
  const {slug}=useLocalSearchParams<{slug:string}>();
  const router=useRouter();
  const {palette}=useAppearance();
  const {session}=useAuth();
  const [conversation,setConversation]=useState<MarketplaceConversation|null>(null);
  const [messages,setMessages]=useState<MarketplaceMessage[]>([]);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [sellerName,setSellerName]=useState('Satıcıyla İletişime Geç');
  const refresh=useCallback(async()=>{
    try{
      const threads=await rmaApi.listMarketplaceConversations();
      const thread=threads.find(item=>item.slug===slug)||null;
      setConversation(thread);
      if(thread?.company_name)setSellerName(thread.company_name);
      else {
        const shop=await rmaApi.getMarketplaceStore(String(slug));
        setSellerName(shop.company_name);
      }
      if(thread)setMessages(await rmaApi.listMarketplaceMessages(Number(thread.id)));
      else setMessages([]);
      setError('');
    }catch(e){setError(e instanceof Error?e.message:'Sohbet açılamadı.');}
    finally{setLoading(false);}
  },[slug]);
  useFocusEffect(useCallback(()=>{void refresh();},[refresh]));
  const send=async()=>{
    const body=text.trim();
    if(!body||busy)return;
    if(!session){router.push('/login');return;}
    setBusy(true);setError('');
    try {
      if(conversation){await rmaApi.sendMarketplaceMessage(conversation.id,body);}
      else {await rmaApi.startMarketplaceConversation(String(slug),body);}
      setText('');
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Mesaj gönderilemedi.');}
    finally{setBusy(false);}
  };
  const me=Number(session?.user?.id||0);
  return <SafeAreaView edges={['top','bottom']} style={[styles.root,{backgroundColor:palette.background}]}>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS==='ios'?'padding':undefined}>
    <View style={[styles.header,{backgroundColor:palette.surface,borderBottomColor:palette.border}]}>
      <Pressable accessibilityLabel="Geri" style={styles.backButton} onPress={()=>router.back()}><Ionicons name="chevron-back" size={24} color={palette.text}/></Pressable>
      <View style={{flex:1}}><Text style={[styles.heading,{color:palette.text}]} numberOfLines={1}>{conversation?.company_name||sellerName}</Text>
        <Text style={[styles.subheading,{color:palette.textSecondary}]}>Uygulama içi güvenli sohbet</Text></View>
      <Pressable onPress={()=>void refresh()}><Ionicons name="refresh" size={21} color={palette.text}/></Pressable>
    </View>
    <View style={styles.safetyNotice} accessibilityRole="alert">
      <Ionicons name="warning-outline" size={15} color="#92400E"/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1}} contentContainerStyle={{alignItems:"center"}}>
        <Text style={styles.safetyNoticeText}>Çalışkan B2B uygulaması dışında gerçekleştirilen her türlü işlem sizin sorumluluğunuzdadır.</Text>
      </ScrollView>
    </View>
    {error?<Text role="alert" style={styles.error}>{error}</Text>:null}
    <FlatList data={messages} keyExtractor={item=>String(item.id)} style={{flex:1}}
      contentContainerStyle={styles.messages}
      ListEmptyComponent={<Text style={[styles.empty,{color:palette.textSecondary}]}>
        {loading?'Sohbet yükleniyor…':'Satıcıyla yeni sohbet başlatmak için mesaj yazın.'}
      </Text>}
      renderItem={({item})=><View style={[styles.bubble,item.author_user_id===me?styles.mine:styles.theirs]}>
        <Text style={styles.bubbleText}>{item.text}</Text>
      </View>}/>
    <View style={[styles.composer,{backgroundColor:palette.surface,borderTopColor:palette.border}]}>
      <TextInput multiline value={text} onChangeText={setText} placeholder="Mesajınızı yazın…"
        placeholderTextColor={palette.textSecondary} style={[styles.input,{color:palette.text,borderColor:palette.border}]} maxLength={4000}/>
      <Pressable accessibilityRole="button" disabled={busy||!text.trim()} onPress={()=>void send()}
        style={[styles.send,(busy||!text.trim())&&{opacity:0.5}]}>
        <Ionicons name="send" size={21} color="#111827"/>
      </Pressable>
    </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  root:{flex:1},header:{paddingHorizontal:14,paddingTop:12,paddingBottom:15,flexDirection:'row',gap:10,alignItems:'center',borderBottomWidth:1,minHeight:76},
  backButton:{width:35,height:48,alignItems:'center',justifyContent:'center'},
  safetyNotice:{marginHorizontal:12,marginTop:6,marginBottom:3,paddingHorizontal:10,height:32,borderRadius:8,borderWidth:1,borderColor:'#F59E0B',backgroundColor:'#FFFBEB',flexDirection:'row',alignItems:'center',gap:7},
  safetyNoticeText:{color:'#78350F',fontSize:11,lineHeight:16,fontWeight:'600'},
  heading:{fontSize:17,fontWeight:'900',lineHeight:23},subheading:{fontSize:12,marginTop:3},messages:{padding:16,flexGrow:1,gap:9},
  empty:{textAlign:'center',marginTop:80,fontSize:13},bubble:{maxWidth:'83%',borderRadius:15,padding:12},
  mine:{alignSelf:'flex-end',backgroundColor:'#FFCD00'},theirs:{alignSelf:'flex-start',backgroundColor:'#E2E8F0'},
  bubbleText:{fontSize:14,lineHeight:21,color:'#111827'},error:{color:'#B91C1C',padding:12},
  composer:{flexDirection:'row',alignItems:'flex-end',padding:12,gap:10,borderTopWidth:1},
  input:{flex:1,borderWidth:1,borderRadius:14,minHeight:44,maxHeight:130,paddingHorizontal:14,paddingTop:11,fontSize:14},
  send:{backgroundColor:'#FFCD00',width:46,height:46,borderRadius:14,alignItems:'center',justifyContent:'center'},
});
