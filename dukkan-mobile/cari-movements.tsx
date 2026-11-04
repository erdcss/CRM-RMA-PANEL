import React,{useCallback,useEffect,useState} from "react";
import {ActivityIndicator,FlatList,Modal,Pressable,SafeAreaView,StyleSheet,Text,View} from "react-native";
import {ChevronDown,ChevronUp,X} from "lucide-react-native";
import {getCariStatement,type CariMovement} from "./remote-db";

type Party={id:number|string;name:string;code?:string|null;source_cari_no?:string|null;balance?:number|string};
type Props={party:Party|null;onClose:()=>void;};
const ink="#16304e",muted="#71839a",border="#e5ebf2";
const money=(v:unknown)=>Number(v||0).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const date=(v:unknown)=>{
 const str=String(v||"").slice(0,10);
 return /^\d{4}-\d{2}-\d{2}$/.test(str)?str.slice(8,10)+"."+str.slice(5,7)+"."+str.slice(0,4):"—";
};
const nameFor=(row:CariMovement)=>
 row.invoice_no?"Fatura "+row.invoice_no:
 row.document_no?"Belge "+row.document_no:
 row.payment_direction==="collection"?"Tahsilat":
 row.payment_direction==="payment"?"Ödeme":
 row.archived_kind==="opening"?"Açılış":row.description||"Cari hareket";

export function CariMovements({party,onClose}:Props){
 const [items,setItems]=useState<CariMovement[]>([]);
 const [next,setNext]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [expanded,setExpanded]=useState<string|null>(null);
 const [retry,setRetry]=useState(0);
 const partyId=Number(party?.id);
 useEffect(()=>{
  if(!party||!Number.isSafeInteger(partyId)||partyId<=0)return;
  let live=true;
  setItems([]);setNext(null);setError("");setExpanded(null);setBusy(true);
  void getCariStatement(partyId).then(result=>{
   if(!live)return;
   setItems(result.entries);setNext(result.nextOffset);
  }).catch(err=>{if(live)setError((err as Error).message);})
   .finally(()=>{if(live)setBusy(false);});
  return ()=>{live=false;};
 },[partyId,retry,Boolean(party)]);
 const more=useCallback(async()=>{
  if(busy||next===null||!party)return;
  setBusy(true);setError("");
  try{
   const result=await getCariStatement(partyId,next);
   setItems(prev=>[...prev,...result.entries.filter(e=>!prev.some(p=>String(p.id)===String(e.id)))]);
   setNext(result.nextOffset);
  }catch(err){setError((err as Error).message);}finally{setBusy(false);}
 },[busy,next,partyId,party]);
 const render=({item}:{item:CariMovement})=>{
  const key=String(item.id),opened=expanded===key;
  const debit=Number(item.debit||0),credit=Number(item.credit||0);
  const lines=item.invoice_lines||[];
  return <Pressable accessibilityRole="button" accessibilityLabel={nameFor(item)+" ayrıntılarını göster"}
   onPress={()=>setExpanded(opened?null:key)} style={styles.entry}>
   <View style={styles.entryHeading}>
    <View style={{flex:1,minWidth:0}}>
     <Text style={styles.entryTitle} numberOfLines={2}>{nameFor(item)}</Text>
     <Text style={styles.entryDate}>{date(item.document_date||item.created_at)}</Text>
    </View>
    {opened?<ChevronUp size={16} color={muted}/>:<ChevronDown size={16} color={muted}/>}
   </View>
   <View style={styles.amountRow}>
    {debit!==0&&<Text style={styles.debit}>Borç {money(debit)}</Text>}
    {credit!==0&&<Text style={styles.credit}>Alacak {money(credit)}</Text>}
   </View>
   <Text style={styles.balance}>İşlem sonrası bakiye: {money(item.running_balance)}</Text>
   {opened&&<View style={styles.detail}>
     {item.description?<Text style={styles.description}>{item.description}</Text>:null}
     {item.due_date?<Text style={styles.description}>Vade: {date(item.due_date)}</Text>:null}
     {lines.map((line,i)=><View key={i} style={styles.line}>
       <Text style={[styles.description,{flex:1}]} numberOfLines={3}>{line.product_name}</Text>
       <Text style={styles.description}>{String(line.quantity)} {line.unit||""}</Text>
       <Text style={styles.description}>{money(line.line_total)}</Text>
     </View>)}
   </View>}
  </Pressable>;
 };
 return <Modal visible={Boolean(party)} animationType="slide" onRequestClose={onClose}
   presentationStyle="pageSheet">
  <SafeAreaView style={styles.safe}>
   <View style={styles.header}>
    <View style={{flex:1,minWidth:0}}>
     <Text style={styles.eyebrow}>CARİ HESAP HAREKETLERİ</Text>
     <Text style={styles.title} numberOfLines={2}>{party?.name||"Cari hesap"}</Text>
     <Text style={styles.subtitle}>{party?.source_cari_no||party?.code||"Mağaza cari kartı"}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Cari hareketlerini kapat"
      onPress={onClose} style={styles.close}><X size={20} color={ink}/></Pressable>
   </View>
   <View style={styles.summary}>
    <Text style={styles.summaryLabel}>Güncel bakiye</Text>
    <Text style={styles.summaryNumber}>{money(Number(party?.balance||0)/100)}</Text>
    <Text style={styles.summaryInfo}>Son işlemler üstte · {items.length} hareket görüntüleniyor</Text>
   </View>
   {error?<View style={styles.message}>
    <Text style={styles.error}>{error}</Text>
    <Pressable onPress={()=>{if(items.length===0)setRetry(v=>v+1);else void more();}}
      style={styles.tryAgain}><Text style={styles.retryText}>Tekrar dene</Text></Pressable>
   </View>:null}
   <FlatList data={items} keyExtractor={item=>String(item.id)} renderItem={render}
     contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
     ListEmptyComponent={!busy&&!error?<View style={styles.empty}>
       <Text style={styles.description}>Bu cari hesaba ait işlem bulunmuyor.</Text>
      </View>:null}
     ListFooterComponent={<View style={{paddingVertical:14}}>
       {busy?<ActivityIndicator color="#3b72a8"/>:
        next!==null?<Pressable accessibilityRole="button" style={styles.more} onPress={()=>void more()}>
          <Text style={styles.moreText}>Daha fazla işlem yükle</Text>
        </Pressable>:null}
     </View>}
   />
  </SafeAreaView>
 </Modal>;
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#f6f8fb"},
 header:{paddingHorizontal:17,paddingTop:17,paddingBottom:14,flexDirection:"row",alignItems:"center",gap:12,backgroundColor:"#fff"},
 eyebrow:{fontSize:10,fontWeight:"400",color:muted,letterSpacing:0},
 title:{fontSize:19,fontWeight:"600",color:ink,marginTop:4},
 subtitle:{fontSize:12,fontWeight:"400",color:muted,marginTop:4},
 close:{backgroundColor:"#eef2f7",padding:10,borderRadius:12},
 summary:{backgroundColor:"#fff",marginHorizontal:14,marginTop:12,padding:15,borderWidth:1,borderColor:border,borderRadius:15},
 summaryLabel:{fontSize:12,fontWeight:"400",color:muted},
 summaryNumber:{fontSize:23,fontWeight:"500",color:ink,marginTop:4},
 summaryInfo:{fontSize:11,fontWeight:"400",color:muted,marginTop:5},
 list:{padding:14,paddingBottom:30,flexGrow:1},
 entry:{backgroundColor:"#fff",padding:14,borderWidth:1,borderColor:border,borderRadius:13,marginBottom:9},
 entryHeading:{flexDirection:"row",alignItems:"center",gap:8},
 entryTitle:{fontSize:13,fontWeight:"500",color:ink},
 entryDate:{fontSize:11,fontWeight:"400",color:muted,marginTop:4},
 amountRow:{flexDirection:"row",flexWrap:"wrap",gap:11,marginTop:9},
 debit:{fontSize:12,fontWeight:"500",color:"#ab4d4d"},
 credit:{fontSize:12,fontWeight:"500",color:"#17816b"},
 balance:{fontSize:11,fontWeight:"400",color:muted,marginTop:6},
 detail:{marginTop:10,paddingTop:11,borderTopWidth:1,borderTopColor:border,gap:8},
 description:{fontSize:11,fontWeight:"400",color:"#3c516a",lineHeight:17},
 line:{flexDirection:"row",alignItems:"flex-start",flexWrap:"wrap",gap:8},
 message:{paddingHorizontal:17,paddingVertical:10},
 error:{color:"#aa3838",fontSize:12,fontWeight:"400"},
 tryAgain:{marginTop:8,alignSelf:"flex-start",backgroundColor:"#e4eefa",padding:10,borderRadius:8},
 retryText:{fontSize:12,fontWeight:"500",color:"#1c4c76"},
 empty:{padding:22,alignItems:"center"},
 more:{backgroundColor:"#e5eef7",borderRadius:12,alignItems:"center",padding:12},
 moreText:{color:"#184d7b",fontSize:12,fontWeight:"500"}
});
