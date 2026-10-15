import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { rmaApi, type B2BLedgerDetail, type B2BLedgerKind, type B2BLedgerMovementType } from '@/lib/api';
import { appAlert } from '@/lib/appAlert';
import { spacing, radius } from '@/constants/theme';

const NAMES: Record<B2BLedgerMovementType,string> = {
  debt: 'Borç ekle', payment: 'Ödeme yapıldı', receivable: 'Alacak ekle', collection: 'Tahsilat alındı',
};
const KIND: Record<B2BLedgerKind,string> = { supplier:'Tedarikçi',customer:'Müşteri',other:'Diğer' };
function currency(value: string | number | undefined | null) {
  const amount=Number(value||0);
  return Number.isFinite(amount) ? (amount/100).toLocaleString('tr-TR',{style:'currency',currency:'TRY'}) : '—';
}
function dateNow() {
  const d=new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
// This token is only an idempotency key, never an authentication credential.
function requestKey() {
  const rand=()=>Math.floor(Math.random()*0x10000).toString(16).padStart(4,'0');
  return rand()+rand()+'-'+rand()+'-4'+rand().slice(1)+'-a'+rand().slice(1)+'-'+rand()+rand()+rand();
}
function normalizeAmount(value:string) {
  const trimmed=value.trim().replace(/\s/g,'');
  return trimmed.includes(',')? trimmed.replace(/\./g,'').replace(',','.') : trimmed;
}

export default function LedgerDetailScreen() {
  const router=useRouter();
  const {id}=useLocalSearchParams<{id?:string}>();
  const {palette}=useAppearance();
  const styles=useMemo(()=>buildStyles(palette),[palette]);
  const [data,setData]=useState<B2BLedgerDetail|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [section,setSection]=useState<'entries'|'notes'|'contact'>('entries');
  const [entryOpen,setEntryOpen]=useState(false);
  const [type,setType]=useState<B2BLedgerMovementType>('debt');
  const [amount,setAmount]=useState('');
  const [effectiveOn,setEffectiveOn]=useState(dateNow());
  const [description,setDescription]=useState('');
  const [pendingKey,setPendingKey]=useState(requestKey);
  const [voidId,setVoidId]=useState<string|null>(null);
  const [voidReason,setVoidReason]=useState('');
  const [note,setNote]=useState('');
  const [editNoteId,setEditNoteId]=useState<string|null>(null);
  const [editNoteText,setEditNoteText]=useState('');
  const [editName,setEditName]=useState('');
  const [editKind,setEditKind]=useState<B2BLedgerKind>('supplier');
  const [editPhone,setEditPhone]=useState('');
  const [editAddress,setEditAddress]=useState('');
  const [editDescription,setEditDescription]=useState('');
  const contactDirty=useRef(false);

  const load=useCallback(async (refresh=false) => {
    if(!id){setError('Defter numarası bulunamadı.');setLoading(false);return;}
    if(refresh)setRefreshing(true);else setLoading(true);
    try {
      const response=await rmaApi.getB2BLedgerContact(id);
      setData(response);setError('');
      if(!contactDirty.current) {
        setEditName(response.name);
        setEditKind(response.kind);
        setEditPhone(response.phone||'');
        setEditAddress(response.address||'');
        setEditDescription(response.description||'');
      }
    } catch(err) {setError(err instanceof Error?err.message:'Defter yüklenemedi');}
    finally {setLoading(false);setRefreshing(false);}
  },[id]);
  useFocusEffect(useCallback(()=>{void load();},[load]));

  async function addEntry() {
    if(busy||!id)return;
    const clean=normalizeAmount(amount);
    if(!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(clean)||Number(clean)<=0) {
      appAlert('Geçersiz tutar','1.250,50 gibi pozitif tutar girin.',undefined,'warning');return;
    }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn)) {
      appAlert('Tarih geçersiz','Tarihi YYYY-AA-GG biçiminde girin.',undefined,'warning');return;
    }
    setBusy(true);
    try {
      await rmaApi.addB2BLedgerEntry(id,{type,amount:clean,effectiveOn,description:description.trim(),requestKey:pendingKey});
      setAmount('');setDescription('');setEffectiveOn(dateNow());setPendingKey(requestKey());setEntryOpen(false);
      await load(true);
    } catch(err) {appAlert('Hareket kaydedilemedi',err instanceof Error?err.message:'Tekrar deneyin',undefined,'error');}
    finally {setBusy(false);}
  }

  async function voidEntry() {
    if(!voidId||busy)return;
    if(voidReason.trim().length<3) {appAlert('Açıklama gerekiyor','İptal nedenini en az üç karakter olarak girin.');return;}
    setBusy(true);
    try {
      await rmaApi.voidB2BLedgerEntry(voidId,voidReason.trim());
      setVoidId(null);setVoidReason('');
      await load(true);
    } catch(err) {appAlert('İptal edilemedi',err instanceof Error?err.message:'Tekrar deneyin',undefined,'error');}
    finally {setBusy(false);}
  }

  async function saveNote() {
    if(!id||busy||!note.trim())return;
    setBusy(true);
    try {await rmaApi.addB2BLedgerNote(id,note.trim());setNote('');await load(true);}
    catch(err) {appAlert('Not kaydedilemedi',err instanceof Error?err.message:'Tekrar deneyin',undefined,'error');}
    finally {setBusy(false);}
  }
  async function updateNote() {
    if(!editNoteId||busy||!editNoteText.trim())return;
    setBusy(true);
    try {await rmaApi.editB2BLedgerNote(editNoteId,editNoteText.trim());setEditNoteId(null);setEditNoteText('');await load(true);}
    catch(err) {appAlert('Not güncellenemedi',err instanceof Error?err.message:'Tekrar deneyin',undefined,'error');}
    finally {setBusy(false);}
  }
  function removeNote(noteId:string) {
    Alert.alert('Notu sil','Bu not silinsin mi?',[
      {text:'Vazgeç',style:'cancel'},
      {text:'Sil',style:'destructive',onPress:()=>{void(async()=>{
        setBusy(true);try {await rmaApi.deleteB2BLedgerNote(noteId);await load(true);}
        catch(err){appAlert('Not silinemedi',err instanceof Error?err.message:'Tekrar deneyin',undefined,'error');}
        finally{setBusy(false);}
      })();}},
    ]);
  }
  async function updateContact() {
    if(!id||busy)return;
    if(!editName.trim()) {appAlert('Firma adı gerekli','Firma adı boş olamaz.');return;}
    setBusy(true);
    try {
      await rmaApi.editB2BLedgerContact(id,{name:editName.trim(),kind:editKind,phone:editPhone.trim(),address:editAddress.trim(),description:editDescription.trim()});
      contactDirty.current=false;await load(true);
      appAlert('Defter güncellendi','Firma bilgileri kaydedildi.',undefined,'success');
    }catch(err){appAlert('Kaydedilemedi',err instanceof Error?err.message:'Tekrar deneyin',undefined,'error');}
    finally{setBusy(false);}
  }

  const sections=[{key:'entries',label:'Hareketler'},{key:'notes',label:'Notlar'},{key:'contact',label:'Firma'}] as const;
  const drawInput=(value:string,onChange:(s:string)=>void,placeholder:string,other?:{multi?:boolean,keyboard?:'numeric'|'phone-pad',max?:number})=>(
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={palette.muted}
      style={[styles.input,other?.multi&&styles.multi]} multiline={other?.multi}
      maxLength={other?.max||500} keyboardType={other?.keyboard||'default'} editable={!busy}/>
  );
  return <Screen style={{backgroundColor:palette.background}}>
    <View style={styles.header}>
      <Pressable onPress={()=>router.back()} style={styles.back} accessibilityLabel="Defterime dön"><Ionicons name="chevron-back" size={23} color={palette.text}/></Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>Defter Detayı</Text>
      <View style={styles.back}/>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)} tintColor={palette.text}/>}>
      {loading?<ActivityIndicator color={palette.accent} style={{marginTop:20}}/>:error||!data?<Pressable style={styles.card} onPress={()=>void load()}>
        <Text style={styles.heading}>Defter yüklenemedi</Text><Text style={styles.muted}>{error||'Kayıt bulunamadı'} · Tekrar dene</Text>
      </Pressable>:<>
        <View style={styles.card}>
          <View style={styles.contactTop}><Ionicons name="business-outline" size={24} color={palette.text}/><View style={{flex:1}}>
            <Text style={styles.contactName}>{data.name}</Text>
            <Text style={styles.muted}>{KIND[data.kind]} · {data.movement_count||0} aktif hareket</Text>
          </View></View>
          <View style={styles.balances}>
            <View style={styles.balanceBox}><Text style={styles.muted}>Alacak bakiyesi</Text><Text style={styles.balanceValue}>{currency(data.receivable_balance_cents)}</Text></View>
            <View style={styles.balanceBox}><Text style={styles.muted}>Borç bakiyesi</Text><Text style={styles.balanceValue}>{currency(data.debt_balance_cents)}</Text></View>
          </View>
        </View>
        <View style={styles.tabs}>{sections.map(item=><Pressable key={item.key} onPress={()=>setSection(item.key)} style={[styles.tab,section===item.key&&styles.tabActive]}>
          <Text style={[styles.tabText,section===item.key&&styles.tabTextActive]}>{item.label}</Text>
        </Pressable>)}</View>

        {section==='entries'?<>
          <Pressable onPress={()=>setEntryOpen(v=>!v)} style={styles.primary}><Ionicons name={entryOpen?'close':'add'} size={21} color="#111827"/><Text style={styles.primaryText}>{entryOpen?'Formu kapat':'Hesap Hareketi Ekle'}</Text></Pressable>
          {entryOpen?<View style={styles.card}>
            <Text style={styles.heading}>Yeni hareket</Text>
            <View style={styles.typeGrid}>
              {(Object.keys(NAMES) as B2BLedgerMovementType[]).map(key=><Pressable key={key} onPress={()=>setType(key)} style={[styles.typeButton,type===key&&styles.selected]}>
                <Text style={[styles.typeText,type===key&&styles.selectedText]}>{NAMES[key]}</Text>
              </Pressable>)}
            </View>
            <Text style={styles.muted}>{type==='debt'?'Firmaya olan borcun artar.':type==='payment'?'Firmaya olan borcun azalır.':type==='receivable'?'Firmadan alacağın artar.':'Firmadan alacağın azalır.'}</Text>
            {drawInput(amount,setAmount,'Tutar (₺) · 1.250,50',{keyboard:'numeric',max:20})}
            {drawInput(effectiveOn,setEffectiveOn,'İşlem tarihi · YYYY-AA-GG',{max:10})}
            {drawInput(description,setDescription,'Açıklama (isteğe bağlı)',{multi:true,max:500})}
            <Pressable disabled={busy||!amount.trim()} style={[styles.primary,busy&&styles.disabled]} onPress={()=>void addEntry()}>{busy?<ActivityIndicator color="#111827"/>:<Text style={styles.primaryText}>Hareketi Kaydet</Text>}</Pressable>
          </View>:null}
          <View style={styles.card}>
            <Text style={styles.heading}>Hareket Geçmişi</Text>
            {!data.entries.length?<Text style={styles.muted}>Henüz hesap hareketi kaydedilmedi.</Text>:
              data.entries.map(entry=><View key={entry.id} style={styles.entry}>
                <View style={{flex:1,gap:3}}>
                  <Text style={[styles.entryTitle,entry.voided_at&&styles.strike]}>{NAMES[entry.type]}</Text>
                  <Text style={[styles.entryAmount,entry.voided_at&&styles.strike]}>{currency(entry.amount_cents)}</Text>
                  <Text style={styles.muted}>{entry.effective_on.slice(0,10)}{entry.description?' · '+entry.description:''}</Text>
                  {entry.voided_at?<Text style={styles.voidText}>İptal edildi · {entry.void_reason||'Açıklama yok'}</Text>:null}
                </View>
                {!entry.voided_at?<Pressable disabled={busy} onPress={()=>{setVoidId(entry.id);setVoidReason('');}} accessibilityLabel="Hareketi iptal et">
                  <Ionicons name="close-circle-outline" color={palette.muted} size={24}/>
                </Pressable>:null}
              </View>)}
          </View>
          {voidId?<View style={styles.card}>
            <Text style={styles.heading}>Hareketi iptal et</Text>
            <Text style={styles.muted}>Kayıt silinmez, iptal geçmişi tutulur. Bakiye yeniden hesaplanır.</Text>
            {drawInput(voidReason,setVoidReason,'İptal nedeni *',{max:300})}
            <View style={styles.actions}><Pressable onPress={()=>setVoidId(null)} style={styles.secondary}><Text style={styles.secondaryText}>Vazgeç</Text></Pressable>
              <Pressable disabled={busy} onPress={()=>void voidEntry()} style={styles.primary}><Text style={styles.primaryText}>İptal Et</Text></Pressable>
            </View>
          </View>:null}
        </>:null}

        {section==='notes'?<View style={styles.card}>
          <Text style={styles.heading}>Firma notları</Text>
          {drawInput(note,setNote,'Firma için not yaz...', {multi:true,max:4000})}
          <Pressable onPress={()=>void saveNote()} disabled={busy||!note.trim()} style={[styles.primary,(busy||!note.trim())&&styles.disabled]}>
            <Ionicons name="add" size={19} color="#111827"/><Text style={styles.primaryText}>Not Ekle</Text>
          </Pressable>
          {!data.notes.length?<Text style={styles.muted}>Henüz not bulunmuyor.</Text>:data.notes.map(item=><View key={item.id} style={styles.note}>
            {editNoteId===item.id?<>
              {drawInput(editNoteText,setEditNoteText,'Notu düzenle',{multi:true,max:4000})}
              <View style={styles.actions}><Pressable style={styles.secondary} onPress={()=>setEditNoteId(null)}><Text style={styles.secondaryText}>Vazgeç</Text></Pressable>
                <Pressable style={styles.primary} disabled={busy||!editNoteText.trim()} onPress={()=>void updateNote()}><Text style={styles.primaryText}>Kaydet</Text></Pressable>
              </View>
            </>:<>
              <Text style={styles.noteText}>{item.content}</Text>
              <Text style={styles.muted}>{new Date(item.updated_at).toLocaleString('tr-TR')}</Text>
              <View style={styles.actions}>
                <Pressable style={styles.secondary} disabled={busy} onPress={()=>{setEditNoteId(item.id);setEditNoteText(item.content);}}><Text style={styles.secondaryText}>Düzenle</Text></Pressable>
                <Pressable style={styles.secondary} disabled={busy} onPress={()=>removeNote(item.id)}><Text style={styles.secondaryText}>Sil</Text></Pressable>
              </View>
            </>}
          </View>)}
        </View>:null}

        {section==='contact'?<View style={styles.card}>
          <Text style={styles.heading}>Firma Bilgileri</Text>
          {drawInput(editName,v=>{setEditName(v);contactDirty.current=true;},'Firma adı',{max:140})}
          <View style={styles.typeGrid}>{(['supplier','customer','other'] as B2BLedgerKind[]).map(kind=><Pressable key={kind} onPress={()=>{setEditKind(kind);contactDirty.current=true;}} style={[styles.typeButton,kind===editKind&&styles.selected]}>
            <Text style={[styles.typeText,kind===editKind&&styles.selectedText]}>{KIND[kind]}</Text>
          </Pressable>)}</View>
          {drawInput(editPhone,v=>{setEditPhone(v);contactDirty.current=true;},'Telefon',{keyboard:'phone-pad',max:45})}
          {drawInput(editAddress,v=>{setEditAddress(v);contactDirty.current=true;},'Adres',{multi:true,max:1000})}
          {drawInput(editDescription,v=>{setEditDescription(v);contactDirty.current=true;},'Firma açıklaması',{multi:true,max:1000})}
          <Pressable style={styles.primary} disabled={busy} onPress={()=>void updateContact()}>{busy?<ActivityIndicator color="#111827"/>:<Text style={styles.primaryText}>Firma Bilgilerini Kaydet</Text>}</Pressable>
        </View>:null}
        <Text style={styles.footer}>Borç ve alacak yalnızca Defterim kayıtlarına göre hesaplanır. Bu modül resmî e-Defter değildir.</Text>
      </>}
    </ScrollView>
  </Screen>;
}
const buildStyles=(p:AppPalette)=>StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12,minHeight:54},
  back:{width:42,height:42,alignItems:'center',justifyContent:'center'},
  headerTitle:{color:p.text,fontSize:18,fontWeight:'900'},
  page:{padding:spacing.md,gap:spacing.md,paddingBottom:120},
  card:{backgroundColor:p.surface,borderRadius:radius.lg,borderWidth:1,borderColor:p.border,padding:spacing.md,gap:spacing.sm},
  contactTop:{flexDirection:'row',alignItems:'center',gap:12},
  contactName:{fontSize:18,fontWeight:'900',color:p.text},
  muted:{color:p.textSecondary,fontSize:12,lineHeight:18},
  balances:{flexDirection:'row',gap:8,marginTop:10},
  balanceBox:{backgroundColor:p.surfaceSecondary,padding:10,borderRadius:radius.md,flex:1,gap:4},
  balanceValue:{fontSize:15,fontWeight:'900',color:p.text},
  tabs:{flexDirection:'row',gap:6,padding:4,backgroundColor:p.surfaceSecondary,borderRadius:radius.md},
  tab:{flex:1,alignItems:'center',borderRadius:radius.sm,paddingVertical:10},
  tabActive:{backgroundColor:p.surface,borderWidth:1,borderColor:p.border},
  tabText:{fontSize:12,fontWeight:'700',color:p.textSecondary},
  tabTextActive:{color:p.text},
  primary:{backgroundColor:'#FACC15',minHeight:44,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6,borderRadius:radius.md,paddingHorizontal:13,paddingVertical:10},
  primaryText:{fontSize:13,fontWeight:'900',color:'#111827'},
  heading:{color:p.text,fontSize:15,fontWeight:'900'},
  typeGrid:{flexDirection:'row',flexWrap:'wrap',gap:7},
  typeButton:{borderWidth:1,borderColor:p.border,borderRadius:radius.sm,paddingHorizontal:10,paddingVertical:9},
  selected:{borderColor:'#C79A00',backgroundColor:p.surfaceSecondary},
  typeText:{color:p.textSecondary,fontSize:12,fontWeight:'700'},
  selectedText:{color:p.text},
  input:{minHeight:46,borderWidth:1,borderColor:p.border,borderRadius:radius.md,paddingHorizontal:12,paddingVertical:10,backgroundColor:p.background,color:p.text,fontSize:14},
  multi:{minHeight:75,textAlignVertical:'top'},
  entry:{borderTopWidth:1,borderTopColor:p.border,flexDirection:'row',alignItems:'center',paddingVertical:12,gap:10},
  entryTitle:{color:p.text,fontSize:13,fontWeight:'800'},
  entryAmount:{color:p.text,fontSize:16,fontWeight:'900'},
  strike:{textDecorationLine:'line-through',color:p.muted},
  voidText:{color:'#F87171',fontSize:11},
  disabled:{opacity:.5},
  actions:{flexDirection:'row',alignItems:'center',gap:8},
  secondary:{borderColor:p.border,borderWidth:1,borderRadius:radius.md,paddingVertical:10,paddingHorizontal:13,minHeight:42,justifyContent:'center'},
  secondaryText:{fontSize:12,fontWeight:'700',color:p.text},
  note:{borderTopWidth:1,borderTopColor:p.border,paddingVertical:12,gap:9},
  noteText:{fontSize:14,color:p.text,lineHeight:21},
  footer:{fontSize:11,color:p.muted,lineHeight:17,textAlign:'center'},
});