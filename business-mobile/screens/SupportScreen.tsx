import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { getBusinessToken } from "../lib/auth";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiFetch } from "../lib/api";
import type { SupportConversation, SupportItem, SupportMessage } from "../types";
import { C, shortDate } from "../ui/theme";
import { BackHeader, EmptyState, PageHeader } from "./common";

type Filter = "all" | "open" | "answered" | "closed";
const FILTERS: Array<{key: Filter; label: string}> = [
  {key:"all",label:"Tümü"},
  {key:"open",label:"Açık"},
  {key:"answered",label:"Yanıtlandı"},
  {key:"closed",label:"Sohbet Arşivi"},
];

function statusKey(status?: string | null): Filter {
  const key=String(status||"open").toLowerCase();
  if(["closed","resolved","done"].includes(key))return "closed";
  if(["answered","replied"].includes(key))return "answered";
  return "open";
}
function statusLabel(status?: string | null) {
  const key=statusKey(status);
  return key==="closed" ? "Kapalı" : key==="answered" ? "Yanıtlandı" : "Açık";
}
function statusColor(status?: string | null) {
  const key=statusKey(status);
  return key==="closed"?C.muted:key==="answered"?C.green:C.orange;
}
function customerName(item:SupportItem) {
  return item.customer_company_name || item.customer_name ||
    [item.customer_first_name,item.customer_last_name].filter(Boolean).join(" ") ||
    item.customer_email || "Müşteri";
}
function ProfileRow({title,value}:{title:string;value?:string|null}) {
  return (
    <View style={s.profileRow}>
      <Text style={s.profileLabel}>{title}</Text>
      <Text style={s.profileValue} selectable>{value?.trim() || "—"}</Text>
    </View>
  );
}

export function SupportScreen({
  initialTicketId,
  onExit,
  readOnly=false,
  isSuperAdmin=false,
}:{
  initialTicketId?:string;
  onExit?:()=>void;
  readOnly?:boolean;
  isSuperAdmin?:boolean;
}) {
  const [items,setItems]=useState<SupportItem[]>([]);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<Filter>("all");
  const [selectedId,setSelectedId]=useState<string|null>(initialTicketId||null);
  const [profileOpen,setProfileOpen]=useState(false);
  const chatRef=useRef<ScrollView>(null);
  const [conversation,setConversation]=useState<SupportConversation|null>(null);
  const [draft,setDraft]=useState("");
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [sending,setSending]=useState(false);
  const [updating,setUpdating]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    try {
      const result=await apiFetch<SupportItem[]>(
        filter==="closed" ? "/api/admin/b2b-support?view=archive" : "/api/admin/b2b-support"
      );
      setItems(Array.isArray(result)?result:[]);
      setError("");
    }catch(e){
      setError(e instanceof Error?e.message:"Destek talepleri yüklenemedi.");
    }finally{
      setLoading(false);
      setRefreshing(false);
    }
  },[filter]);

  const loadDetail=useCallback(async(id:string,quiet=false)=>{
    if(!quiet)setDetailLoading(true);
    try{
      const result=await apiFetch<SupportConversation>(`/api/admin/b2b-support/${encodeURIComponent(id)}`);
      setConversation(result);
      setError("");
    }catch(e){
      setError(e instanceof Error?e.message:"Destek görüşmesi açılamadı.");
    }finally{
      setDetailLoading(false);
    }
  },[]);

  useEffect(()=>{
    void load();
    const timer=setInterval(()=>{void load();},20_000);
    return()=>clearInterval(timer);
  },[load]);
  useEffect(()=>{
    if(initialTicketId)setSelectedId(initialTicketId);
  },[initialTicketId]);
  useEffect(()=>{
    if(!selectedId){setConversation(null);return;}
    void loadDetail(selectedId);
    const timer=setInterval(()=>{void loadDetail(selectedId,true);},15_000);
    return()=>clearInterval(timer);
  },[selectedId,loadDetail]);

  const counts=useMemo(()=>({
    open:items.filter(i=>statusKey(i.status)==="open").length,
    answered:items.filter(i=>statusKey(i.status)==="answered").length,
    closed:items.filter(i=>statusKey(i.status)==="closed").length,
  }),[items]);
  const filtered=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase("tr-TR");
    return items.filter(item=>(filter==="all"||statusKey(item.status)===filter)
      && (!needle || [
        item.subject,item.message,item.last_message,item.customer_name,
        item.customer_email,item.customer_phone,String(item.id)
      ].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR").includes(needle)));
  },[items,filter,query]);

  async function sendReply(){
    const id=selectedId;
    const message=draft.trim();
    if(!id||readOnly||sending||message.length<2||message.length>4000)return;
    setSending(true);
    setError("");
    try {
      await apiFetch(`/api/admin/b2b-support/${encodeURIComponent(id)}/messages`,{
        method:"POST",body:JSON.stringify({message}),
      });
      setDraft("");
      await Promise.all([loadDetail(id,true),load()]);
    }catch(e){
      setError(e instanceof Error?e.message:"Yanıt gönderilemedi.");
    }finally{setSending(false);}
  }
  async function changeStatus(next:"open"|"closed"){
    if(!selectedId||readOnly||updating)return;
    setUpdating(true);
    try{
      await apiFetch(`/api/admin/b2b-support/${encodeURIComponent(selectedId)}/status`,{
        method:"PATCH",body:JSON.stringify({status:next}),
      });
      if(next==="closed"){
        // Move straight to the supervisor archive after closing.
        setSelectedId(null);
        setConversation(null);
        setFilter("closed");
      }else{
        setSelectedId(null);
        setConversation(null);
        setFilter("all");
      }
    }catch(e){
      setError(e instanceof Error?e.message:"Talep durumu değiştirilemedi.");
    }finally{setUpdating(false);}
  }


  async function attachPhoto(){
    if(!selectedId||sending||readOnly)return;
    try{
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted){
        Alert.alert("Fotoğraflar", "Görsel seçmek için fotoğraf erişimi vermelisiniz.");
        return;
      }
      const picked=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images"],quality:0.75,base64:true,allowsEditing:false,
      });
      if(picked.canceled||!picked.assets?.[0])return;
      const asset=picked.assets[0];
      if(!asset.base64)throw new Error("Seçilen fotoğraf okunamadı");
      setSending(true);
      await apiFetch(`/api/admin/b2b-support/${encodeURIComponent(selectedId)}/attachments`,{
        method:"POST",body:JSON.stringify({
          mimeType:asset.mimeType||"image/jpeg",
          fileName:asset.fileName||"destek-gorseli.jpg",
          base64:asset.base64,message:draft.trim().slice(0,1000),
        }),
      });
      setDraft("");
      await Promise.all([loadDetail(selectedId,true),load()]);
    }catch(e){
      Alert.alert("Görsel gönderilemedi",e instanceof Error?e.message:"İşlem sırasında hata oluştu");
    }finally{setSending(false);}
  }
  const mediaBase=(process.env.EXPO_PUBLIC_API_URL||"https://admin.ecalisgan.com").replace(/\\/$/,"");
  const copyField=async(value:string)=>{
    if(!value||value==="—")return;
    await Clipboard.setStringAsync(value);
    Alert.alert("Kopyalandı","Bilgi panoya kopyalandı.");
  };
  const ticket=conversation?.ticket;
  const messages:SupportMessage[]=ticket?[
    {id:"initial",ticket_id:ticket.id,sender_role:"customer",message:ticket.message||"",created_at:ticket.created_at||""},
    ...(conversation?.messages||[]),
  ]:[];


  if(selectedId&&profileOpen&&ticket){
    const fields=[
      ["Firma",ticket.customer_company_name],
      ["Yetkili",[ticket.customer_first_name,ticket.customer_last_name].filter(Boolean).join(" ")],
      ["Telefon",ticket.customer_phone],
      ["E-posta",ticket.customer_email],
      ["Sektör",ticket.customer_category],
      ["Vergi dairesi",ticket.customer_tax_office],
      ["Vergi numarası",ticket.customer_tax_number],
      ["Adres",[ticket.customer_address,ticket.customer_district,ticket.customer_city].filter(Boolean).join(", ")],
      ["Üyelik tarihi",ticket.customer_registered_at?shortDate(ticket.customer_registered_at):""],
      ["Müşteri numarası",ticket.user_id?String(ticket.user_id):""],
    ] as Array<[string,string|null|undefined]>;
    return (
      <ScrollView style={s.page} contentContainerStyle={s.profilePage}>
        <BackHeader title="Müşteri Bilgileri" subtitle={customerName(ticket)}
          onBack={()=>setProfileOpen(false)}/>
        <View style={s.customerTop}>
          <Ionicons name="business" size={27} color={C.blue}/>
          <View style={{flex:1}}>
            <Text style={s.companyName}>{customerName(ticket)}</Text>
            <Text style={s.note}>Her satıra dokunarak bilgiyi kopyalayabilirsiniz.</Text>
          </View>
        </View>
        {fields.map(([label,value])=>(
          <Pressable key={label} style={s.copyRow} accessibilityRole="button"
            accessibilityLabel={label+" kopyala"}
            onPress={()=>void copyField(String(value||""))}>
            <View style={{flex:1}}>
              <Text style={s.profileLabel}>{label}</Text>
              <Text style={s.copyValue} selectable>{value?.trim()||"—"}</Text>
            </View>
            <Ionicons name="copy-outline" size={20} color={C.blue}/>
          </Pressable>
        ))}
      </ScrollView>
    );
  }
  if(selectedId){
    return (
      <KeyboardAvoidingView style={s.threadPage}
        behavior={Platform.OS==="ios"?"padding":undefined}
        keyboardVerticalOffset={0}>
        <View style={s.threadHeader}>
          <Pressable onPress={()=>{
            setSelectedId(null);setConversation(null);setProfileOpen(false);setDraft("");setError("");
          }} accessibilityRole="button" accessibilityLabel="Görüşmeden çık">
            <Ionicons name="chevron-back" size={28} color={C.text}/>
          </Pressable>
          <Pressable style={s.threadPerson} onPress={()=>setProfileOpen(true)}
            accessibilityRole="button" accessibilityLabel="Müşteri bilgilerini görüntüle">
            <View style={s.smallAvatar}><Ionicons name="business-outline" size={19} color={C.blue}/></View>
            <View style={{flex:1}}>
              <Text style={s.threadTitle} numberOfLines={1}>{ticket?customerName(ticket):"Destek Görüşmesi"}</Text>
              <Text style={s.threadSubtitle} numberOfLines={1}>
                {ticket?.subject||`Talep #${selectedId}`}
              </Text>
            </View>
            <Ionicons name="information-circle-outline" size={23} color={C.text2}/>
          </Pressable>
        </View>
        {error?<Text style={s.threadError}>{error}</Text>:null}
        <ScrollView ref={chatRef} style={s.threadScroll}
          contentContainerStyle={s.threadMessages}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={()=>chatRef.current?.scrollToEnd({animated:false})}>
          {detailLoading&&!conversation?<ActivityIndicator color={C.blue} style={{marginTop:35}}/>:null}
          {ticket?(
            <>
              <View style={s.threadSubject}>
                <Text style={s.threadSubjectText}>{ticket.subject||"Destek Talebi"}</Text>
                <Text style={s.date}>{shortDate(ticket.created_at)} · {statusLabel(ticket.status)}</Text>
              </View>
              {messages.map(item=>{
                const mine=item.sender_role==="admin";
                const media=Number(item.attachment_id||0)>0;
                const url=media?`${mediaBase}/api/admin/b2b-support/${selectedId}/attachments/${item.attachment_id}`:"";
                return (
                  <View key={String(item.id)} style={[s.msg,mine?s.mine:s.theirs]}>
                    {media&&item.attachment_mime?.startsWith("image/")?(
                      <Image style={s.mediaPreview} resizeMode="contain"
                        source={{uri:url,headers:{Authorization:"Bearer "+getBusinessToken()}}}/>
                    ):media?(
                      <View style={s.documentBadge}>
                        <Ionicons name="document-attach-outline" size={22} color={C.text2}/>
                        <Text style={s.documentText} numberOfLines={2}>{item.attachment_name||"Dosya"}</Text>
                      </View>
                    ):null}
                    {item.message?<Text selectable style={s.msgText}>{item.message}</Text>:null}
                    <Text style={s.msgMeta}>
                      {mine?"Yönetici":"Müşteri"} · {shortDate(item.created_at)}
                    </Text>
                  </View>
                );
              })}
            </>
          ):null}
        </ScrollView>
        {ticket&&statusKey(ticket.status)==="closed"?(
          <View style={s.threadClosed}>
            <Text style={s.closedText}>Bu görüşme sonlandırıldı.</Text>
            {isSuperAdmin&&!readOnly?(
              <Pressable style={s.smallButton} disabled={updating}
                onPress={()=>void changeStatus("open")}>
                <Text style={s.smallButtonText}>Yeniden Aç</Text>
              </Pressable>
            ):null}
          </View>
        ):ticket?(
          <View style={s.composerWrap}>
            {isSuperAdmin&&!readOnly?(
              <Pressable style={s.closeLink} accessibilityRole="button"
                onPress={()=>Alert.alert("Görüşme sonlandırılsın mı?",
                  "Görüşme müşteriden kaldırılıp yönetici arşivine taşınacak.",
                  [{text:"Vazgeç",style:"cancel"},{text:"Talebi Kapat",style:"destructive",onPress:()=>void changeStatus("closed")}])}>
                <Ionicons name="checkmark-done-outline" size={15} color={C.muted}/>
                <Text style={s.closeLinkText}>Talebi Kapat</Text>
              </Pressable>
            ):null}
            <View style={s.composerRow}>
              <Pressable style={s.attachButton} disabled={readOnly||sending}
                accessibilityRole="button" accessibilityLabel="Görsel ekle"
                onPress={()=>void attachPhoto()}>
                <Ionicons name="add" size={27} color={C.blue}/>
              </Pressable>
              <TextInput multiline scrollEnabled value={draft} onChangeText={setDraft}
                maxLength={4000} editable={!sending&&!readOnly}
                placeholder="Mesaj yazın…" placeholderTextColor={C.muted}
                accessibilityLabel="Destek mesajı"
                style={s.messageInput}/>
              <Pressable onPress={()=>void sendReply()} accessibilityRole="button"
                accessibilityLabel="Mesajı gönder"
                style={[s.sendCircle,(sending||readOnly||draft.trim().length<2)&&s.disabled]}
                disabled={sending||readOnly||draft.trim().length<2}>
                {sending?<ActivityIndicator color="#fff"/>:
                  <Ionicons name="send" size={20} color="#fff"/>}
              </Pressable>
            </View>
          </View>
        ):null}
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl tintColor={C.text} refreshing={refreshing}
        onRefresh={()=>{
          setRefreshing(true);
          void Promise.all([load(),selectedId?loadDetail(selectedId,true):Promise.resolve()])
            .finally(()=>setRefreshing(false));
        }}/>}
    >
      {selectedId ? (
        <>
          <BackHeader title="Destek Görüşmesi" subtitle={`Talep #${selectedId}`}
            onBack={()=>{setSelectedId(null);setConversation(null);setDraft("");setError("");}}/>
          {error?<Text style={s.error}>{error}</Text>:null}
          {detailLoading&&!conversation?<ActivityIndicator size="large" color={C.blue} style={s.loader}/>:null}
          {ticket ? (
            <>
              <View style={s.detailHead}>
                <View style={{flex:1}}>
                  <Text style={s.subjectBig}>{ticket.subject||`Talep #${ticket.id}`}</Text>
                  <Text style={s.date}>{shortDate(ticket.created_at)}</Text>
                </View>
                <View style={[s.pill,{backgroundColor:statusColor(ticket.status)+"24"}]}>
                  <Text style={[s.pillText,{color:statusColor(ticket.status)}]}>{statusLabel(ticket.status)}</Text>
                </View>
              </View>

              <View style={s.companyCard}>
                <View style={s.companyHeader}>
                  <View style={s.companyAvatar}><Ionicons name="business-outline" size={25} color={C.blue}/></View>
                  <View style={{flex:1}}>
                    <Text style={s.cardOverline}>MÜŞTERİ / FİRMA BİLGİLERİ</Text>
                    <Text style={s.companyName}>{customerName(ticket)}</Text>
                    <Text style={s.companyId}>Müşteri no: {ticket.user_id||"—"}</Text>
                  </View>
                </View>
                <ProfileRow title="Firma" value={ticket.customer_company_name}/>
                <ProfileRow title="Yetkili" value={[ticket.customer_first_name,ticket.customer_last_name].filter(Boolean).join(" ")}/>
                <ProfileRow title="Telefon" value={ticket.customer_phone}/>
                <ProfileRow title="E-posta" value={ticket.customer_email}/>
                <ProfileRow title="Sektör" value={ticket.customer_category}/>
                <ProfileRow title="Vergi dairesi" value={ticket.customer_tax_office}/>
                <ProfileRow title="Vergi numarası" value={ticket.customer_tax_number}/>
                <ProfileRow title="Adres" value={[ticket.customer_address,ticket.customer_district,ticket.customer_city].filter(Boolean).join(", ")}/>
                <ProfileRow title="Üyelik tarihi" value={ticket.customer_registered_at?shortDate(ticket.customer_registered_at):null}/>
              </View>

              <View style={s.chatHeader}>
                <Ionicons name="chatbubbles-outline" size={19} color={C.blue}/>
                <Text style={s.sectionTitle}>Mesajlaşma</Text>
                <Text style={s.caption}>{messages.length} mesaj</Text>
              </View>
              <View style={s.chat}>
                {messages.filter(item=>item.message.trim()).map((item)=>(
                  <View key={String(item.id)} style={[s.bubble,
                    item.sender_role==="admin"?s.bubbleAdmin:s.bubbleCustomer]}>
                    <View style={s.bubbleHeading}>
                      <Text style={[s.bubbleAuthor,{color:item.sender_role==="admin"?C.green:C.blue}]}>
                        {item.sender_role==="admin"?"Çalışkan B2B":"Müşteri"}
                      </Text>
                      <Text style={s.bubbleTime}>{shortDate(item.created_at)}</Text>
                    </View>
                    <Text style={s.bubbleText} selectable>{item.message}</Text>
                  </View>
                ))}
              </View>

              {readOnly? <Text style={s.mutedNote}>İnceleme hesabında yazışmalar salt okunur.</Text>:null}
              {statusKey(ticket.status)==="closed" ? (
                <View style={s.closedNotice}>
                  <Ionicons name="lock-closed-outline" size={19} color={C.text2}/>
                  <Text style={s.closedText}>Talep kapalı. Yanıt vermek için yeniden açın.</Text>
                  {!readOnly&&isSuperAdmin?<Pressable style={s.smallButton} onPress={()=>void changeStatus("open")} disabled={updating}>
                    <Text style={s.smallButtonText}>Yeniden Aç</Text>
                  </Pressable>:null}
                </View>
              ) : (
                <View style={s.compose}>
                  <Text style={s.composeLabel}>Müşteriye yanıt yaz</Text>
                  <TextInput style={s.composeInput} multiline
                    placeholder="Mesajınızı Türkçe yazın…"
                    placeholderTextColor={C.muted}
                    value={draft} onChangeText={setDraft}
                    maxLength={4000} editable={!sending&&!readOnly}
                    accessibilityLabel="Destek yanıtı"/>
                  <View style={s.composeBottom}>
                    <Text style={s.characterCount}>{draft.length}/4000</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Yanıtı gönder"
                      disabled={readOnly||sending||draft.trim().length<2}
                      style={[s.sendButton,(readOnly||sending||draft.trim().length<2)&&s.disabled]}
                      onPress={()=>void sendReply()}>
                      {sending?<ActivityIndicator color="#fff"/>:<Ionicons name="send" size={17} color="#fff"/>}
                      <Text style={s.sendText}>{sending?"Gönderiliyor":"Yanıtı Gönder"}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              {!readOnly&&isSuperAdmin&&statusKey(ticket.status)!=="closed"?(
                <Pressable style={s.closeButton} disabled={updating}
                  onPress={() => Alert.alert(
                    "Görüşme sonlandırılsın mı?",
                    "Bu talep müşterinin destek listesinden kaldırılacak, geçmiş süper yönetici arşivinde saklanacak ve müşteriye kapanış bildirimi gönderilecek.",
                    [
                      {text:"Vazgeç",style:"cancel"},
                      {text:"Talebi Kapat",style:"destructive",onPress:()=>void changeStatus("closed")},
                    ]
                  )}>
                  <Ionicons name="checkmark-circle-outline" size={19} color={C.text2}/>
                  <Text style={s.closeText}>{updating?"Kaydediliyor…":"Talebi Kapat"}</Text>
                </Pressable>
              ):null}
            </>
          ):!detailLoading?<EmptyState title="Görüşme açılamadı" text="Talep bilgilerini yeniden yükleyin."/>:null}
        </>
      ):(
        <>
          <PageHeader title="Destek Merkezi"
            subtitle="Müşteri taleplerini inceleyin, firma bilgilerini görün ve doğrudan yanıtlayın."
            right={onExit?<Pressable onPress={onExit} accessibilityLabel="Geri" style={s.listExit}>
              <Ionicons name="close" size={20} color={C.text}/>
            </Pressable>:undefined}/>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={21} color={C.muted}/>
            <TextInput style={s.searchInput} placeholder="Firma, konu veya mesaj ara…"
              placeholderTextColor={C.muted} value={query} onChangeText={setQuery}/>
          </View>
          {filter==="closed"?<Text style={s.archiveHeading}>Süper Yönetici · Kapatılan Sohbet Arşivi</Text>:null}
          <View style={s.stats}>
            <View style={s.stat}><Text style={s.statLabel}>{filter==="closed"?"Arşivlenen":"Aktif Talepler"}</Text><Text style={s.statValue}>{items.length}</Text></View>
            <View style={s.stat}><Text style={s.statLabel}>Açık</Text><Text style={[s.statValue,{color:C.orange}]}>{counts.open}</Text></View>
            <View style={s.stat}><Text style={s.statLabel}>Yanıtlanan</Text><Text style={[s.statValue,{color:C.green}]}>{counts.answered}</Text></View>
          </View>
          <View style={s.filters}>{FILTERS.filter(it=>it.key!=="closed"||isSuperAdmin).map(it=>(
            <Pressable key={it.key} style={[s.filter,filter===it.key&&s.filterActive]} onPress={()=>setFilter(it.key)}>
              <Text style={[s.filterText,filter===it.key&&s.filterTextActive]}>{it.label}</Text>
            </Pressable>
          ))}</View>
          {error?<Text style={s.error}>{error}</Text>:null}
          {loading?<ActivityIndicator size="large" color={C.blue} style={s.loader}/>:
            filtered.length===0?<EmptyState title="Talep bulunamadı" text="Bu filtrede görüntülenecek destek talebi yok."/>:
            <View style={s.list}>{filtered.map(item=>(
              <Pressable key={String(item.id)} style={s.listCard} accessibilityRole="button"
                accessibilityLabel={`${customerName(item)} destek talebini aç`}
                onPress={()=>{setSelectedId(String(item.id));setConversation(null);setDraft("");}}>
                <View style={s.listTop}>
                  <View style={s.listCompany}>
                    <View style={s.initial}><Ionicons name="business-outline" size={17} color={C.blue}/></View>
                    <View style={{flex:1}}>
                      <Text style={s.listName} numberOfLines={1}>{customerName(item)}</Text>
                      <Text style={s.date}>{shortDate(item.updated_at||item.created_at)}</Text>
                    </View>
                  </View>
                  <View style={[s.pill,{backgroundColor:statusColor(item.status)+"24"}]}>
                    <Text style={[s.pillText,{color:statusColor(item.status)}]}>{statusLabel(item.status)}</Text>
                  </View>
                </View>
                <Text style={s.listSubject} numberOfLines={2}>{item.subject||item.title||`Talep #${item.id}`}</Text>
                <Text style={s.listPreview} numberOfLines={2}>{item.last_message||item.message||"Mesaj bulunmuyor"}</Text>
                <View style={s.listFooter}><Text style={s.chatCount}>{(item.reply_count||0)+1} mesaj</Text>
                  <View style={s.openRow}><Text style={s.openText}>Sohbeti Aç</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.blue}/></View>
                </View>
              </Pressable>
            ))}</View>
          }
        </>
      )}
    </ScrollView>
  );
}
const s=StyleSheet.create({
  threadPage:{flex:1,backgroundColor:C.bg},
  threadHeader:{flexDirection:"row",alignItems:"center",gap:9,paddingHorizontal:14,
    paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.line,backgroundColor:C.panel},
  threadPerson:{flexDirection:"row",alignItems:"center",gap:11,flex:1,minWidth:0},
  smallAvatar:{height:40,width:40,borderRadius:20,backgroundColor:C.blueSoft,
    alignItems:"center",justifyContent:"center"},
  threadTitle:{fontSize:16,fontWeight:"800",color:C.text},
  threadSubtitle:{fontSize:11,color:C.text2,marginTop:4},
  threadScroll:{flex:1},
  threadMessages:{paddingHorizontal:14,paddingTop:18,paddingBottom:16,flexGrow:1,justifyContent:"flex-end"},
  threadSubject:{alignSelf:"center",backgroundColor:C.panel2,padding:12,borderRadius:16,marginBottom:18,alignItems:"center"},
  threadSubjectText:{fontSize:13,color:C.text,fontWeight:"700"},
  msg:{borderRadius:17,maxWidth:"86%",paddingHorizontal:12,paddingVertical:10,marginBottom:8,borderWidth:1},
  mine:{alignSelf:"flex-end",backgroundColor:"#17433B",borderColor:"#235B4C",borderBottomRightRadius:4},
  theirs:{alignSelf:"flex-start",backgroundColor:C.panel2,borderColor:C.line,borderBottomLeftRadius:4},
  msgText:{fontSize:14,color:C.text,lineHeight:21},
  msgMeta:{fontSize:9,color:"#AAB9BF",textAlign:"right",marginTop:5},
  mediaPreview:{width:220,height:185,borderRadius:10,marginBottom:7},
  documentBadge:{flexDirection:"row",alignItems:"center",gap:8,paddingVertical:5},
  documentText:{color:C.text2,flexShrink:1,fontSize:12},
  composerWrap:{paddingHorizontal:10,paddingVertical:10,
    backgroundColor:C.panel,borderTopWidth:1,borderTopColor:C.line},
  composerRow:{flexDirection:"row",gap:8,alignItems:"flex-end"},
  attachButton:{height:44,width:43,alignItems:"center",justifyContent:"center",borderRadius:22,backgroundColor:C.bg2},
  messageInput:{flex:1,minHeight:45,maxHeight:135,color:C.text,backgroundColor:C.bg2,
    borderColor:C.line,borderWidth:1,borderRadius:22,paddingHorizontal:14,
    paddingVertical:10,fontSize:14,textAlignVertical:"center"},
  sendCircle:{height:45,width:45,backgroundColor:C.blue,borderRadius:23,alignItems:"center",justifyContent:"center"},
  closeLink:{flexDirection:"row",gap:5,alignItems:"center",alignSelf:"flex-end",padding:5,marginBottom:5},
  closeLinkText:{color:C.muted,fontSize:11,fontWeight:"700"},
  threadClosed:{flexDirection:"row",padding:18,alignItems:"center",backgroundColor:C.panel,gap:10},
  threadError:{color:C.red,paddingHorizontal:15,paddingVertical:8},
  profilePage:{paddingHorizontal:17,paddingBottom:65},
  customerTop:{backgroundColor:C.panel,borderRadius:20,padding:18,flexDirection:"row",alignItems:"center",gap:15,marginBottom:12},
  note:{color:C.muted,fontSize:11,marginTop:5},
  copyRow:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:14,
    marginVertical:4,padding:16,flexDirection:"row",gap:12,alignItems:"center"},
  copyValue:{color:C.text,fontSize:14,fontWeight:"600",marginTop:6,flexWrap:"wrap"},
  listExit:{padding:10,borderRadius:12,borderColor:C.line,borderWidth:1},

  page:{flex:1,backgroundColor:C.bg},
  content:{paddingHorizontal:17,paddingTop:12,paddingBottom:132},
  loader:{marginTop:28},
  searchBox:{minHeight:54,borderWidth:1,borderColor:C.line,borderRadius:17,
    backgroundColor:C.panel,paddingHorizontal:13,flexDirection:"row",alignItems:"center",gap:10,marginBottom:14},
  searchInput:{flex:1,color:C.text,fontSize:14,paddingVertical:12},
  stats:{flexDirection:"row",gap:8,marginBottom:17},
  archiveHeading:{fontSize:13,fontWeight:"700",color:C.text2,marginBottom:12},
  stat:{flex:1,borderRadius:16,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,
    minHeight:88,padding:12,justifyContent:"space-between"},
  statLabel:{color:C.text2,fontSize:11,fontWeight:"600"},
  statValue:{color:C.text,fontSize:26,fontWeight:"700"},
  filters:{flexDirection:"row",gap:6,marginBottom:14},
  filter:{flex:1,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,borderRadius:12,
    paddingVertical:10,alignItems:"center"},
  filterActive:{backgroundColor:C.blueSoft,borderColor:C.blue},
  filterText:{color:C.text2,fontSize:11,fontWeight:"600"},
  filterTextActive:{color:C.blue},
  list:{gap:11},
  listCard:{borderRadius:20,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,padding:15,gap:9},
  listTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:9},
  listCompany:{flex:1,flexDirection:"row",alignItems:"center",gap:10},
  initial:{height:36,width:36,borderRadius:12,backgroundColor:C.blueSoft,justifyContent:"center",alignItems:"center"},
  listName:{color:C.text,fontSize:13,fontWeight:"700"},
  date:{color:C.muted,fontSize:10,marginTop:3},
  listSubject:{color:C.text,fontSize:16,fontWeight:"700"},
  listPreview:{color:C.text2,fontSize:12,lineHeight:18},
  listFooter:{borderTopWidth:1,borderColor:C.lineSoft,paddingTop:10,
    flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  chatCount:{color:C.muted,fontSize:11},
  openRow:{flexDirection:"row",alignItems:"center",gap:2},
  openText:{color:C.blue,fontWeight:"700",fontSize:12},
  pill:{paddingHorizontal:9,paddingVertical:6,borderRadius:10},
  pillText:{fontSize:10,fontWeight:"700"},
  error:{color:C.red,fontSize:12,marginBottom:12,lineHeight:19},
  detailHead:{flexDirection:"row",alignItems:"flex-start",gap:10,marginBottom:16},
  subjectBig:{color:C.text,fontSize:21,fontWeight:"700"},
  companyCard:{backgroundColor:C.panel,borderColor:C.line,borderWidth:1,borderRadius:22,
    paddingHorizontal:15,paddingVertical:16,marginBottom:22},
  companyHeader:{flexDirection:"row",gap:11,alignItems:"center",paddingBottom:14,
    borderBottomWidth:1,borderBottomColor:C.lineSoft,marginBottom:9},
  companyAvatar:{width:47,height:47,borderRadius:14,backgroundColor:C.blueSoft,
    alignItems:"center",justifyContent:"center"},
  cardOverline:{color:C.muted,fontSize:10,fontWeight:"700",letterSpacing:0.5},
  companyName:{color:C.text,fontSize:17,fontWeight:"800",marginTop:3},
  companyId:{color:C.muted,fontSize:11,marginTop:3},
  profileRow:{paddingVertical:8,flexDirection:"row",gap:10,borderBottomWidth:1,borderBottomColor:C.lineSoft},
  profileLabel:{width:105,color:C.muted,fontSize:11,lineHeight:18},
  profileValue:{flex:1,color:C.text2,fontSize:12,lineHeight:18},
  chatHeader:{flexDirection:"row",gap:8,alignItems:"center",marginBottom:13},
  sectionTitle:{fontSize:17,color:C.text,fontWeight:"700",flex:1},
  caption:{fontSize:11,color:C.muted},
  chat:{gap:10,marginBottom:20},
  bubble:{padding:14,borderRadius:18,borderWidth:1,maxWidth:"94%"},
  bubbleCustomer:{alignSelf:"flex-start",backgroundColor:C.panel,borderColor:C.line},
  bubbleAdmin:{alignSelf:"flex-end",backgroundColor:"#0E2926",borderColor:"#25544C"},
  bubbleHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:7},
  bubbleAuthor:{fontSize:11,fontWeight:"700"},
  bubbleTime:{fontSize:9,color:C.muted},
  bubbleText:{color:C.text,fontSize:14,lineHeight:21},
  compose:{backgroundColor:C.panel,borderColor:C.line,borderWidth:1,borderRadius:20,padding:14},
  composeLabel:{fontSize:13,fontWeight:"700",color:C.text,marginBottom:8},
  composeInput:{color:C.text,borderRadius:12,borderColor:C.line,borderWidth:1,
    backgroundColor:C.bg2,minHeight:102,maxHeight:220,textAlignVertical:"top",fontSize:14,
    padding:12},
  composeBottom:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:12},
  characterCount:{color:C.muted,fontSize:11},
  sendButton:{backgroundColor:C.blue,paddingHorizontal:16,paddingVertical:12,borderRadius:13,
    flexDirection:"row",alignItems:"center",gap:8,minHeight:44},
  disabled:{opacity:0.42},
  sendText:{color:"#FFFFFF",fontSize:13,fontWeight:"700"},
  closedNotice:{borderRadius:16,backgroundColor:C.panel,padding:13,
    flexDirection:"row",gap:8,alignItems:"center"},
  closedText:{color:C.text2,flex:1,fontSize:12},
  smallButton:{padding:10,borderRadius:10,backgroundColor:C.blueSoft},
  smallButtonText:{color:C.blue,fontWeight:"700",fontSize:12},
  closeButton:{borderRadius:14,borderWidth:1,borderColor:C.line,padding:14,
    flexDirection:"row",justifyContent:"center",alignItems:"center",gap:8,marginTop:13},
  closeText:{color:C.text2,fontSize:13,fontWeight:"700"},
  mutedNote:{color:C.muted,fontSize:12,marginBottom:12}
});
