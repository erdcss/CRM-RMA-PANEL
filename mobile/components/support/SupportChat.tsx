import {useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Image,KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {Screen} from '@/components/ui/Screen';
import {useAppearance} from '@/contexts/AppearanceContext';
import {API_BASE_URL,rmaApi,type B2BSupportConversation,type B2BSupportMessage} from '@/lib/api';
import {localAuth} from '@/lib/supabase';
import {openB2BSupportFile} from '@/lib/support-attachments';

export function SupportChat({ticketId,onBack,onClosed}:{
  ticketId:number;onBack:()=>void;onClosed:()=>void;
}){
  const {palette}=useAppearance();
  const [conversation,setConversation]=useState<B2BSupportConversation|null>(null);
  const [draft,setDraft]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [bearer,setBearer]=useState('');
  const scroller=useRef<ScrollView>(null);
  const refresh=useCallback(async()=>{
    try{
      const [data,auth]=await Promise.all([rmaApi.getB2BSupportConversation(ticketId),localAuth.getRequestCredentials()]);
      setConversation(data);
      if(auth.token)setBearer(auth.token);
      setError('');
    }catch(e){
      const msg=e instanceof Error?e.message:'Görüşme açılamadı.';
      if(/404|bulunamadı|sonlandırılmış/i.test(msg)){onClosed();return;}
      setError(msg);
    }finally{setLoading(false);}
  },[ticketId,onClosed]);
  useEffect(()=>{
    void refresh();
    const timer=setInterval(()=>void refresh(),12000);
    return()=>clearInterval(timer);
  },[refresh]);

  const send=async()=>{
    const message=draft.trim();
    if(busy||message.length<2||!conversation)return;
    setBusy(true);
    try{
      await rmaApi.replyB2BSupport(ticketId,message);
      setDraft('');
      await refresh();
    }catch(e){
      Alert.alert('Mesaj gönderilemedi',e instanceof Error?e.message:'Tekrar deneyin.');
    }finally{setBusy(false);}
  };
  const attach=async()=>{
    if(busy||!conversation)return;
    try{
      const result=await DocumentPicker.getDocumentAsync({
        type:['image/*','application/pdf','text/plain',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory:true,
      });
      if(result.canceled||!result.assets?.[0])return;
      const file=result.assets[0];
      if(file.size&&file.size>5*1024*1024){
        Alert.alert('Dosya çok büyük','En fazla 5 MB dosya yükleyebilirsiniz.');
        return;
      }
      setBusy(true);
      const base64=await FileSystem.readAsStringAsync(file.uri,{
        encoding:FileSystem.EncodingType.Base64,
      });
      await rmaApi.uploadB2BSupportAttachment(ticketId,{
        fileName:file.name||'destek-dosyasi',
        mimeType:file.mimeType||'application/octet-stream',
        base64,message:draft.trim().slice(0,1000),
      });
      setDraft('');
      await refresh();
    }catch(e){
      Alert.alert('Dosya gönderilemedi',e instanceof Error?e.message:'Tekrar deneyin.');
    }finally{setBusy(false);}
  };
  const messages:B2BSupportMessage[]=conversation?[{
    id:-1,ticket_id:ticketId,sender_role:'customer',
    message:conversation.ticket.message,created_at:conversation.ticket.created_at||'',
  },...conversation.messages]:[];
  const displayTime=(raw:string)=>{
    const date=new Date(raw);
    return Number.isNaN(date.getTime())?'':date.toLocaleString('tr-TR',{hour:'2-digit',minute:'2-digit'});
  };
  return (
    <Screen edges={['top','bottom']} style={{backgroundColor:palette.background}}>
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS==='ios'?'padding':undefined}>
        <View style={[s.header,{backgroundColor:palette.surface,borderColor:palette.border}]}>
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Geri">
            <Ionicons name="chevron-back" size={29} color={palette.text}/>
          </Pressable>
          <View style={s.avatar}><Ionicons name="headset" size={20} color="#FFFFFF"/></View>
          <View style={{flex:1}}>
            <Text style={[s.title,{color:palette.text}]} numberOfLines={1}>Çalışkan B2B Destek</Text>
            <Text style={{color:palette.textSecondary,fontSize:11}} numberOfLines={1}>
              {conversation?.ticket.subject||`Destek Talebi #${ticketId}`}
            </Text>
          </View>
        </View>
        {error?<Text style={s.error}>{error}</Text>:null}
        <ScrollView ref={scroller} style={{flex:1}} contentContainerStyle={s.chat}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={()=>scroller.current?.scrollToEnd({animated:false})}>
          {loading?<ActivityIndicator color="#1E7BEB" style={{marginTop:35}}/>:null}
          {messages.map(item=>{
            const mine=item.sender_role==='customer';
            const attachment=Number(item.attachment_id||0)>0;
            const isImage=Boolean(item.attachment_mime?.startsWith('image/'));
            return (
              <View key={item.id} style={[s.bubble,{
                alignSelf:mine?'flex-end':'flex-start',
                backgroundColor:mine?'#DCF8C6':'#FFFFFF',
                borderBottomRightRadius:mine?4:18,borderBottomLeftRadius:mine?18:4,
              }]}>
                {attachment?(
                  <Pressable onPress={()=>void openB2BSupportFile(
                    ticketId,Number(item.attachment_id),
                    item.attachment_name||'dosya',item.attachment_mime||'application/octet-stream',
                  ).catch(e=>Alert.alert('Dosya açılamadı',e instanceof Error?e.message:'Tekrar deneyin.'))}>
                    {isImage&&bearer?(
                      <Image style={s.photo} resizeMode="cover"
                        source={{uri:`${API_BASE_URL}/api/b2b/support/${ticketId}/attachments/${item.attachment_id}`,
                          headers:{Authorization:`Bearer ${bearer}`}}}/>
                    ):(
                      <View style={s.fileChip}>
                        <Ionicons name="document-attach-outline" color="#135E6C" size={22}/>
                        <Text style={{color:'#23303B',flex:1,fontSize:12}} numberOfLines={2}>
                          {item.attachment_name||'Dosya'}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ):null}
                {item.message?<Text selectable style={s.bubbleText}>{item.message}</Text>:null}
                <Text style={s.time}>{displayTime(item.created_at)}</Text>
              </View>
            );
          })}
        </ScrollView>
        <View style={[s.composer,{backgroundColor:palette.surface,borderColor:palette.border}]}>
          <Pressable onPress={()=>void attach()} disabled={busy} style={s.attach}
            accessibilityRole="button" accessibilityLabel="Fotoğraf veya dosya ekle">
            <Ionicons name="add-circle-outline" size={29} color="#2683DD"/>
          </Pressable>
          <TextInput multiline scrollEnabled value={draft} onChangeText={setDraft}
            placeholder="Mesaj yazın…" placeholderTextColor="#84919F"
            editable={!busy} maxLength={4000} style={[s.input,{color:palette.text,backgroundColor:palette.background,borderColor:palette.border}]}/>
          <Pressable onPress={()=>void send()} disabled={busy||draft.trim().length<2}
            style={[s.send,(busy||draft.trim().length<2)&&{opacity:0.45}]}
            accessibilityRole="button" accessibilityLabel="Mesajı gönder">
            {busy?<ActivityIndicator color="#FFFFFF"/>:
              <Ionicons name="send" size={19} color="#FFFFFF"/>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
const s=StyleSheet.create({
  root:{flex:1},
  header:{flexDirection:'row',alignItems:'center',gap:10,padding:12,
    borderBottomWidth:1},
  avatar:{width:39,height:39,borderRadius:20,backgroundColor:'#2274C9',alignItems:'center',justifyContent:'center'},
  title:{fontSize:15,fontWeight:'800'},
  error:{color:'#FA5263',fontSize:12,padding:10},
  chat:{flexGrow:1,justifyContent:'flex-end',paddingHorizontal:13,paddingVertical:16},
  bubble:{maxWidth:'84%',marginBottom:9,paddingHorizontal:12,paddingVertical:9,
    borderRadius:18,shadowColor:'#000000',shadowOpacity:0.06,shadowRadius:2},
  bubbleText:{fontSize:14,lineHeight:21,color:'#1D2935'},
  time:{alignSelf:'flex-end',fontSize:9,color:'#64727B',marginTop:5},
  photo:{width:220,height:190,borderRadius:10,marginBottom:5},
  fileChip:{flexDirection:'row',gap:8,alignItems:'center',paddingVertical:7,maxWidth:220},
  composer:{paddingHorizontal:10,paddingTop:10,paddingBottom:8,borderTopWidth:1,
    flexDirection:'row',alignItems:'flex-end',gap:8},
  attach:{width:38,height:42,alignItems:'center',justifyContent:'center'},
  input:{flex:1,minHeight:42,maxHeight:125,borderWidth:1,borderRadius:21,
    paddingHorizontal:14,paddingVertical:10,fontSize:14,textAlignVertical:'center'},
  send:{height:43,width:43,borderRadius:22,backgroundColor:'#2274C9',alignItems:'center',justifyContent:'center'},
});
