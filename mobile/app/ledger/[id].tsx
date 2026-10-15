import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { rmaApi, type B2BLedgerDetail, type B2BLedgerKind, type B2BLedgerWallet, type B2BLedgerContact, type LedgerOperation, type LedgerOperationType, type LedgerCategory } from '@/lib/api';
import { appAlert } from '@/lib/appAlert';

type TransactionType=LedgerOperationType;
const NAMES:Record<TransactionType,string>={sale:'SATIŞ',collection:'TAHSİLAT',purchase:'ALIŞ',payment:'ÖDEME',transfer:'TRANSFER'};
const COLORS:Record<TransactionType,string>={sale:'#2287CF',collection:'#239763',purchase:'#D35442',payment:'#C44739',transfer:'#238BB5'};
const MONEY=(x:string|number|undefined|null)=>(Number(x||0)/100).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₺';
function now(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function token(){const h=()=>Math.floor(Math.random()*65536).toString(16).padStart(4,'0');return h()+h()+'-'+h()+'-4'+h().slice(1)+'-a'+h().slice(1)+'-'+h()+h()+h();}
function positiveAmount(s:string){if(!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(s))return false;return Number(s)>0;}
function htmlEscape(s:unknown){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

export default function LedgerCurrentAccount() {
  const router=useRouter(),{id}=useLocalSearchParams<{id?:string}>();
  const {palette}=useAppearance();
  const styles=useMemo(()=>makeStyles(palette),[palette]);
  const [data,setData]=useState<B2BLedgerDetail|null>(null);
  const [history,setHistory]=useState<LedgerOperation[]>([]);
  const [wallets,setWallets]=useState<B2BLedgerWallet[]>([]);
  const [people,setPeople]=useState<B2BLedgerContact[]>([]);
  const [categories,setCategories]=useState<LedgerCategory[]>([]);
  const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [type,setType]=useState<TransactionType>('sale');
  const [amount,setAmount]=useState('');
  const [date,setDate]=useState(now());
  const [description,setDescription]=useState('');
  const [category,setCategory]=useState('');
  const [requestKey,setRequestKey]=useState(token);
  const [walletId,setWalletId]=useState('');
  const [targetId,setTargetId]=useState('');
  const [sheet,setSheet]=useState<'options'|'edit'|'wallet'|'target'|'category'|'cancel'|null>(null);
  const [cancelId,setCancelId]=useState(''),[cancelReason,setCancelReason]=useState('');
  const [walletName,setWalletName]=useState('');
  const [walletType,setWalletType]=useState<'cash'|'bank'>('bank');
  const [categoryName,setCategoryName]=useState('');
  const [editName,setEditName]=useState('');
  const [editKind,setEditKind]=useState<B2BLedgerKind>('other');
  const [editPhone,setEditPhone]=useState(''),[editAddress,setEditAddress]=useState(''),[editDescription,setEditDescription]=useState('');

  const load=useCallback(async(refresh=false)=>{
    if(!id){setError('Hesap seçilmedi');setLoading(false);return;}
    if(refresh)setRefreshing(true);else setLoading(true);
    try{
      const [person,ops,w,b,c]=await Promise.all([
        rmaApi.getB2BLedgerContact(id),rmaApi.getLedgerOperations(id),
        rmaApi.listB2BLedgerWallets(),rmaApi.listB2BLedgerContacts(),rmaApi.getLedgerCategories(),
      ]);
      setData(person);setHistory(ops);setWallets(w);setPeople(b);setCategories(c);setError('');
      setEditName(person.name);setEditKind(person.kind);
      setEditPhone(person.phone||'');setEditAddress(person.address||'');setEditDescription(person.description||'');
    }catch(e){setError(e instanceof Error?e.message:'Cari hesap okunamadı.');}
    finally{setLoading(false);setRefreshing(false);}
  },[id]);
  useFocusEffect(useCallback(()=>{void load();},[load]));

  const requiresWallet=type==='collection'||type==='payment';
  const requiresTarget=type==='transfer';
  const activeColor=COLORS[type];
  const selectedWallet=wallets.find(w=>w.id===walletId);
  const selectedTarget=people.find(p=>p.id===targetId);
  const totalNet=BigInt(data?.receivable_balance_cents||'0')-BigInt(data?.debt_balance_cents||'0');
  const movements=useMemo(()=>{
    const active=history.map(op=>({
      id:'op-'+op.id,kind:'modern' as const,type:op.type,
      amount_cents:op.amount_cents,date:String(op.effective_on).slice(0,10),
      description:op.description,category:op.category,
      related:op.type==='transfer'?((op.target_contact_id===id)?'Gelen transfer · '+(op.source_name||'Kaynak cari'):'Giden transfer · '+(op.target_name||'Hedef cari')):
        op.wallet_name||'',cancelled:Boolean(op.voided_at),
    }));
    const legacy=(data?.entries||[]).filter(e=>!e.operation_id).map(e=>({
      id:'legacy-'+e.id,kind:'old' as const,type:e.type,
      amount_cents:e.amount_cents,date:String(e.effective_on).slice(0,10),
      description:e.description,category:'',related:'',cancelled:Boolean(e.voided_at),
    }));
    return [...active,...legacy].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  },[history,data?.entries,id]);

  async function saveOperation(){
    if(!id||busy)return;
    const normalized=amount.replace(',','.');
    if(!positiveAmount(normalized)){appAlert('Tutar hatalı','Pozitif ve iki ondalık basamağı aşmayan bir tutar girin.');return;}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+'T00:00:00Z').valueOf())){
      appAlert('Tarih hatalı','Tarihi YYYY-AA-GG biçiminde girin.');return;
    }
    if(requiresWallet&&!walletId){setSheet('wallet');return;}
    if(requiresTarget&&(!targetId||targetId===id)){setSheet('target');return;}
    setBusy(true);
    try{
      await rmaApi.postLedgerOperation({
        contactId:id,type,amount:normalized,effectiveOn:date,description:description.trim(),
        category:category.trim(),walletId:requiresWallet?walletId:undefined,
        targetContactId:requiresTarget?targetId:undefined,requestKey,
      });
      setAmount('');setDescription('');setRequestKey(token());setTargetId('');setWalletId('');
      await load(true);
    }catch(e){appAlert('İşlem tamamlanamadı',e instanceof Error?e.message:'Tekrar deneyin',undefined,'error');}
    finally{setBusy(false);}
  }
  async function addWallet(){
    if(!walletName.trim()||busy)return;
    setBusy(true);
    try{
      const created=await rmaApi.createLedgerWallet(walletName.trim(),walletType);
      setWalletId(created.id);setWalletName('');setSheet(null);await load(true);
    }catch(e){appAlert('Hesap oluşturulamadı',e instanceof Error?e.message:'Tekrar deneyin',undefined,'error');}
    finally{setBusy(false);}
  }
  async function addCategory(){
    if(!categoryName.trim()||busy)return;
    setBusy(true);
    try{const cat=await rmaApi.addLedgerCategory(categoryName.trim());setCategory(cat.name);setCategoryName('');setSheet(null);await load(true);}
    catch(e){appAlert('Kategori kaydedilemedi',e instanceof Error?e.message:'Tekrar deneyin',undefined,'error');}
    finally{setBusy(false);}
  }
  async function editContact(){
    if(!id||!editName.trim()||busy)return;
    setBusy(true);
    try{
      await rmaApi.editB2BLedgerContact(id,{name:editName.trim(),kind:editKind,phone:editPhone.trim(),address:editAddress.trim(),description:editDescription.trim()});
      setSheet(null);await load(true);
    }catch(e){appAlert('Değişiklik kaydedilemedi',e instanceof Error?e.message:'Tekrar deneyin',undefined,'error');}
    finally{setBusy(false);}
  }
  function archive(){
    if(!id)return;setSheet(null);
    Alert.alert('Hesabı arşive kaldır','Geçmiş hareketler korunacak, hesap aktif listeden kaldırılacak.',[
      {text:'Vazgeç',style:'cancel'},
      {text:'Arşivle',onPress:()=>void(async()=>{try{await rmaApi.archiveB2BLedgerContact(id);router.replace('/ledger' as never);}
        catch(e){appAlert('Hata',String(e),undefined,'error');}})()},
    ]);
  }
  function remove(){
    if(!id)return;setSheet(null);
    Alert.alert('Hesabı sil','İşlem geçmişi olan hesaplar silinemez, arşivlenmelidir. Boş hesap silinsin mi?',[
      {text:'Vazgeç',style:'cancel'},{text:'Sil',style:'destructive',onPress:()=>void(async()=>{
        try{await rmaApi.deleteLedgerContact(id);router.replace('/ledger' as never);}
        catch(e){appAlert('Silinemedi',e instanceof Error?e.message:'Tekrar deneyin',undefined,'warning');}
      })()},
    ]);
  }
  async function cancelOperation(){
    if(!cancelId||cancelReason.trim().length<3||busy)return;
    setBusy(true);
    try{
      await rmaApi.voidLedgerOperation(cancelId,cancelReason.trim());
      setSheet(null);setCancelId('');setCancelReason('');await load(true);
    }catch(e){appAlert('İptal edilemedi',e instanceof Error?e.message:'Tekrar deneyin',undefined,'error');}
    finally{setBusy(false);}
  }
  async function shareStatement(){
    if(!data||busy||!id)return;
    setBusy(true);
    try{
      // All pages come from the authenticated owner-scoped server, including
      // PDF-imported opening entries and cancelled historical movements.
      const pages: Array<{
        type:string;amount_cents:string;effective_on:string;description:string;
        voided_at?:string|null;operation_type?:string|null;
        category?:string|null;wallet_name?:string|null;target_name?:string|null;source_name?:string|null;
        target_contact_id?:string|null;
      }>=[];
      let more=true;
      for(let offset=0;more&&offset<30000;offset+=300){
        const page=await rmaApi.getLedgerStatementPage(id,offset);
        pages.push(...page.items);more=page.hasMore;
      }
      if(more)throw new Error('Ekstre 30.000 işlem sınırını aşıyor; PDF üretilmedi. Destek ekibiyle görüşün.');
      const rows=pages.map(m=>{
        const label=m.operation_type?NAMES[m.operation_type as TransactionType]||m.operation_type:
          ({debt:'BORÇ',payment:'ÖDEME',receivable:'ALACAK',collection:'TAHSİLAT'} as Record<string,string>)[m.type]||m.type;
        return '<tr><td>'+htmlEscape(String(m.effective_on).slice(0,10))+'</td><td>'+htmlEscape(label)+'</td><td>'+
          htmlEscape(m.description)+(m.voided_at?' (İPTAL)':'')+'</td><td>'+
          htmlEscape([m.wallet_name,m.target_contact_id===id?m.source_name:m.target_name,m.category].filter(Boolean).join(' · '))+
          '</td><td style="text-align:right">'+htmlEscape(MONEY(m.amount_cents))+'</td></tr>';
      }).join('');
      const html='<!DOCTYPE html><html><head><meta charset="utf-8"><style>'+
        'body{font-family:Helvetica,Arial,sans-serif;color:#17202a;padding:25px}h1{font-size:23px}p{font-size:12px}table{width:100%;border-collapse:collapse;font-size:10px}td,th{padding:9px;border-bottom:1px solid #ddd}th{text-align:left;background:#edf2f7}'+
        '</style></head><body><h1>'+htmlEscape(data.name)+'</h1><p>Cari hesap ekstresi · '+htmlEscape(now())+
        ' · '+pages.length+' hareket</p><p>Alacak: '+htmlEscape(MONEY(data.receivable_balance_cents))+
        ' | Borç: '+htmlEscape(MONEY(data.debt_balance_cents))+
        ' | Net: '+htmlEscape(MONEY(totalNet.toString()))+
        '</p><table><thead><tr><th>Tarih</th><th>İşlem</th><th>Açıklama</th><th>İlgili hesap</th><th>Tutar</th></tr></thead><tbody>'+rows+
        '</tbody></table><p>Bu belge kullanıcı tarafından tutulan ticari takip ekstresidir; resmî belge değildir.</p></body></html>';
      const pdf=await Print.printToFileAsync({html});
      if(await Sharing.isAvailableAsync())await Sharing.shareAsync(pdf.uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:'Cari hesap ekstresi'});
      else appAlert('PDF oluşturuldu','Bu cihazda paylaşım desteği bulunmuyor.');
    }catch(e){appAlert('PDF oluşturulamadı',e instanceof Error?e.message:'Tekrar deneyin',undefined,'error');}
    finally{setBusy(false);}
  }
  function keypad(key:string){
    if(key==='back'){setAmount(s=>s.slice(0,-1));return;}
    if(key==='.') {setAmount(s=>s.includes('.')?s:(s||'0')+'.');return;}
    setAmount(s=>{
      if(s.replace(/\D/g,'').length>=9)return s;
      if(s.includes('.')&&s.split('.')[1].length>=2)return s;
      return s==='0'?key:s+key;
    });
  }
  const input=(v:string,onChange:(text:string)=>void,hint:string,max=500,multiline=false)=>(
    <TextInput style={[styles.input,multiline&&{minHeight:75,textAlignVertical:'top'}]} value={v}
      onChangeText={onChange} placeholder={hint} placeholderTextColor={palette.muted} maxLength={max} multiline={multiline}/>
  );
  return <Screen style={{backgroundColor:palette.background}}>
    <View style={styles.header}>
      <Pressable style={styles.headerButton} onPress={()=>router.back()} accessibilityLabel="Geri"><Ionicons name="chevron-back" size={24} color={palette.text}/></Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{data?.name||'Cari Hesap'}</Text>
      <Pressable style={styles.headerButton} onPress={()=>void shareStatement()} accessibilityLabel="Ekstre PDF paylaş"><Ionicons name="share-outline" size={22} color={palette.text}/></Pressable>
      <Pressable style={styles.headerButton} onPress={()=>setSheet('options')} accessibilityLabel="Hesap seçenekleri"><Ionicons name="options-outline" size={23} color={palette.text}/></Pressable>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)} tintColor={palette.text}/>}>
      {loading?<ActivityIndicator color="#FACC15"/>:error||!data?<Pressable style={styles.card} onPress={()=>void load()}>
        <Text style={styles.title}>{error||'Hesap bulunamadı'} · Yenile</Text>
      </Pressable>:<>
        <View style={styles.balance}>
          <Text style={styles.small}>BAŞLANGIÇ / CARİ BAKİYE</Text>
          <Text style={[styles.large,{color:totalNet>0n?'#EF5543':palette.text}]}>{MONEY(totalNet.toString())}</Text>
          <Text style={styles.small}>Alacak {MONEY(data.receivable_balance_cents)} · Borç {MONEY(data.debt_balance_cents)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>İşlemler</Text>
          {movements.length===0?<Text style={styles.small}>Henüz işlem yok. İlk işlemi aşağıdan ekle.</Text>:
            movements.map(m=><View key={m.id} style={styles.historyRow}>
              <View style={{flex:1,gap:4}}>
                <Text style={[styles.historyLabel,m.cancelled&&{textDecorationLine:'line-through',color:palette.muted}]}>
                  {m.kind==='old'?({debt:'ALIŞ / BORÇ',payment:'ÖDEME',receivable:'SATIŞ / ALACAK',collection:'TAHSİLAT'} as Record<string,string>)[m.type]:NAMES[m.type as TransactionType]}
                </Text>
                <Text style={styles.small}>{m.date}{m.category?' · '+m.category:''}{m.description?' · '+m.description:''}{m.related?' · '+m.related:''}</Text>
              </View>
              <Text style={[styles.historyAmount,{color:m.type==='sale'||m.type==='collection'||m.type==='receivable'?'#249966':'#EF5543'}]}>
                {MONEY(m.amount_cents)}
              </Text>
              {m.kind==='modern'&&!m.cancelled?<Pressable accessibilityLabel="İşlemi iptal et" onPress={()=>{setCancelId(m.id.slice(3));setCancelReason('');setSheet('cancel');}}>
                <Ionicons name="close-circle-outline" size={19} color={palette.muted}/>
              </Pressable>:null}
              {m.cancelled?<Ionicons name="ban-outline" color={palette.muted} size={17}/>:null}
            </View>)}
        </View>
        <View style={[styles.editor,{borderColor:activeColor}]}>
          <View style={styles.editorTop}>
            <Ionicons name="calendar-outline" color={palette.textSecondary} size={18}/>
            <TextInput style={styles.dateInput} value={date} onChangeText={setDate} maxLength={10}
              placeholder="YYYY-AA-GG" placeholderTextColor={palette.muted}/>
          </View>
          {requiresWallet?<Pressable style={styles.selector} onPress={()=>setSheet('wallet')}>
            <Ionicons name="business-outline" size={19} color={palette.textSecondary}/>
            <Text style={styles.selectorText}>{selectedWallet?.name|| (type==='collection'?'Aktarılan kasa / banka seç':'Kaynak kasa / banka seç')}</Text>
            <Ionicons name="chevron-forward" color={palette.muted}/>
          </Pressable>:null}
          {requiresTarget?<Pressable style={styles.selector} onPress={()=>setSheet('target')}>
            <Ionicons name="people-outline" size={19} color={palette.textSecondary}/>
            <Text style={styles.selectorText}>{selectedTarget?.name||'Hedef cari hesap seç'}</Text>
            <Ionicons name="chevron-forward" color={palette.muted}/>
          </Pressable>:null}
          <Pressable style={styles.selector} onPress={()=>setSheet('category')}>
            <Ionicons name="pricetag-outline" size={19} color={palette.textSecondary}/>
            <Text style={styles.selectorText}>{category||'Kategori seçin (isteğe bağlı)'}</Text>
            <Ionicons name="chevron-down" color={palette.muted}/>
          </Pressable>
          <TextInput style={[styles.input,{borderWidth:0,minHeight:57}]} value={description} onChangeText={setDescription}
            placeholder="Açıklama (isteğe bağlı)" placeholderTextColor={palette.muted} multiline maxLength={500}/>
          <View style={styles.amountRow}>
            <Text style={styles.amountText}>{amount||'0'} ₺</Text>
            <Pressable style={[styles.submit,{backgroundColor:activeColor},busy&&{opacity:.45}]} disabled={busy}
              onPress={()=>void saveOperation()}>
              <Ionicons name="add" color="#FFFFFF" size={23}/>
              <Text style={styles.submitText}>{busy?'KAYDEDİLİYOR':NAMES[type]}</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {(Object.keys(NAMES) as TransactionType[]).map(t=><Pressable key={t} style={[styles.tab,type===t&&{borderBottomColor:COLORS[t],borderBottomWidth:3}]}
              onPress={()=>{setType(t);setWalletId('');setTargetId('');}}>
              <Text style={[styles.tabText,type===t&&{color:COLORS[t],fontWeight:'900'}]}>{NAMES[t]}</Text>
            </Pressable>)}
          </ScrollView>
        </View>
        <View style={styles.keypad}>
          {['1','2','3','4','5','6','7','8','9','.','0','back'].map(k=><Pressable key={k} style={styles.key} onPress={()=>keypad(k)}>
            {k==='back'?<Ionicons name="backspace-outline" size={25} color={palette.text}/>:<Text style={styles.keyText}>{k}</Text>}
          </Pressable>)}
        </View>
      </>}
    </ScrollView>
    <Modal visible={Boolean(sheet)} transparent animationType="slide" onRequestClose={()=>setSheet(null)}>
      <View style={styles.modal}><Pressable style={{flex:1}} onPress={()=>setSheet(null)}/>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheet}>
          <View style={styles.handle}/>
          {sheet==='options'?<>
            <Text style={styles.title}>Cari Hesap Seçenekleri</Text>
            {([{label:'Hesap adını / bilgilerini değiştir',icon:'pencil-outline',act:()=>setSheet('edit')},
              {label:'İletişim bilgisi ekle',icon:'call-outline',act:()=>setSheet('edit')},
              {label:'Arşive kaldır',icon:'archive-outline',act:archive},
              {label:'Hesabı sil',icon:'trash-outline',act:remove}] as const).map(o=>
              <Pressable key={o.label} style={styles.sheetRow} onPress={o.act}>
                <Ionicons name={o.icon} size={22} color={o.icon==='trash-outline'?'#EF5543':palette.text}/>
                <Text style={styles.selectorText}>{o.label}</Text>
                <Ionicons name="chevron-forward" color={palette.muted}/>
              </Pressable>)}
          </>:null}
          {sheet==='edit'?<>
            <Text style={styles.title}>Cari Bilgileri</Text>
            {input(editName,setEditName,'Cari hesap adı *',140)}
            <View style={styles.editKinds}>{([{id:'supplier',label:'Tedarikçi'},{id:'customer',label:'Müşteri'},{id:'other',label:'Diğer'}] as const).map(k=>
              <Pressable key={k.id} style={[styles.kind,editKind===k.id&&{borderColor:'#FACC15'}]} onPress={()=>setEditKind(k.id)}>
                <Text style={styles.selectorText}>{k.label}</Text>
              </Pressable>)}</View>
            {input(editPhone,setEditPhone,'Telefon',45)}
            {input(editAddress,setEditAddress,'Adres',1000,true)}
            {input(editDescription,setEditDescription,'Açıklama',1000,true)}
            <Pressable style={styles.yellowButton} disabled={busy} onPress={()=>void editContact()}><Text style={styles.yellowText}>Kaydet</Text></Pressable>
          </>:null}
          {sheet==='wallet'?<>
            <Text style={styles.title}>{type==='collection'?'Tahsilatın Aktarılacağı Hesap':'Ödemenin Kaynak Hesabı'}</Text>
            {wallets.map(w=><Pressable key={w.id} style={styles.sheetRow} onPress={()=>{setWalletId(w.id);setSheet(null);}}>
              <Ionicons name={w.kind==='cash'?'wallet-outline':'business-outline'} color={palette.text} size={21}/>
              <View style={{flex:1}}><Text style={styles.selectorText}>{w.name}</Text><Text style={styles.small}>Bakiye {MONEY(w.balance_cents)}</Text></View>
              {walletId===w.id?<Ionicons name="checkmark-circle" size={22} color="#FACC15"/>:null}
            </Pressable>)}
            <Text style={styles.small}>Hesabın yoksa yeni bir banka veya kasa hesabı ekleyebilirsin.</Text>
            <View style={styles.editKinds}>
              {(['bank','cash'] as const).map(k=><Pressable key={k} style={[styles.kind,walletType===k&&{borderColor:'#FACC15'}]} onPress={()=>setWalletType(k)}>
                <Text style={styles.selectorText}>{k==='bank'?'Banka':'Kasa'}</Text>
              </Pressable>)}
            </View>
            {input(walletName,setWalletName,'Yeni banka / kasa adı',140)}
            <Pressable style={styles.yellowButton} disabled={busy||!walletName.trim()} onPress={()=>void addWallet()}><Text style={styles.yellowText}>+ Hesap oluştur ve seç</Text></Pressable>
          </>:null}
          {sheet==='target'?<>
            <Text style={styles.title}>Transfer Hedef Cari</Text>
            {people.filter(p=>p.id!==id).map(p=><Pressable key={p.id} style={styles.sheetRow} onPress={()=>{setTargetId(p.id);setSheet(null);}}>
              <Ionicons name="person-circle-outline" color={palette.text} size={22}/>
              <Text style={styles.selectorText}>{p.name}</Text>
              {targetId===p.id?<Ionicons name="checkmark-circle" color="#FACC15" size={22}/>:null}
            </Pressable>)}
            {!people.filter(p=>p.id!==id).length?<Text style={styles.small}>Önce Defterim ana sayfasından başka bir cari hesap oluşturun.</Text>:null}
          </>:null}
          {sheet==='cancel'?<>
            <Text style={styles.title}>İşlemi İptal Et</Text>
            <Text style={styles.small}>Cari ve bağlı kasa/banka/transfer hareketleri birlikte iptal edilir. Kayıt geçmişte korunur.</Text>
            {input(cancelReason,setCancelReason,'İptal nedeni (en az 3 karakter)',300,true)}
            <Pressable style={styles.yellowButton} disabled={busy||cancelReason.trim().length<3} onPress={()=>void cancelOperation()}>
              <Text style={styles.yellowText}>İşlemi iptal et</Text>
            </Pressable>
          </>:null}
          {sheet==='category'?<>
            <Text style={styles.title}>İşlem Kategorisi</Text>
            <Pressable style={styles.sheetRow} onPress={()=>{setCategory('');setSheet(null);}}><Text style={styles.selectorText}>Kategorisiz</Text></Pressable>
            {categories.map(c=><Pressable key={c.id} style={styles.sheetRow} onPress={()=>{setCategory(c.name);setSheet(null);}}><Text style={styles.selectorText}>{c.name}</Text></Pressable>)}
            {input(categoryName,setCategoryName,'Yeni kategori adı',120)}
            <Pressable style={styles.yellowButton} disabled={busy||!categoryName.trim()} onPress={()=>void addCategory()}><Text style={styles.yellowText}>Kategori ekle</Text></Pressable>
          </>:null}
        </ScrollView>
      </View>
    </Modal>
  </Screen>;
}
const makeStyles=(p:AppPalette)=>StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',height:60,paddingHorizontal:10,backgroundColor:p.surface,borderBottomWidth:1,borderBottomColor:p.border},
  headerButton:{width:43,height:44,justifyContent:'center',alignItems:'center'},headerTitle:{flex:1,color:p.text,fontSize:18,fontWeight:'900',textAlign:'center'},
  page:{padding:12,gap:12,paddingBottom:70},
  card:{backgroundColor:p.surface,borderRadius:13,borderWidth:1,borderColor:p.border,padding:14,gap:10},
  balance:{paddingVertical:15,borderBottomWidth:1,borderBottomColor:p.border,gap:8},
  large:{fontSize:30,fontWeight:'900'},small:{fontSize:12,color:p.textSecondary,lineHeight:18},
  title:{color:p.text,fontSize:17,fontWeight:'900'},historyRow:{flexDirection:'row',gap:8,alignItems:'center',borderTopWidth:1,borderTopColor:p.border,paddingVertical:10},
  historyLabel:{color:p.text,fontSize:13,fontWeight:'800'},historyAmount:{fontSize:15,fontWeight:'900'},
  editor:{borderWidth:2,borderRadius:12,backgroundColor:p.surface,overflow:'hidden'},
  editorTop:{flexDirection:'row',alignItems:'center',minHeight:43,paddingHorizontal:12,borderBottomWidth:1,borderBottomColor:p.border,gap:8},
  dateInput:{color:p.text,flex:1,fontSize:14,minHeight:41},
  selector:{paddingHorizontal:12,minHeight:47,borderBottomWidth:1,borderBottomColor:p.border,flexDirection:'row',alignItems:'center',gap:8},
  selectorText:{color:p.text,fontSize:14,flex:1},
  input:{paddingHorizontal:12,paddingVertical:10,backgroundColor:p.background,color:p.text,minHeight:45,borderColor:p.border,borderWidth:1,borderRadius:9,fontSize:14},
  amountRow:{flexDirection:'row',backgroundColor:p.background,minHeight:66,alignItems:'center',paddingLeft:14},
  amountText:{fontSize:24,color:p.text,flex:1,fontWeight:'700'},
  submit:{alignSelf:'stretch',minWidth:125,paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
  submitText:{color:'#FFFFFF',fontSize:11,fontWeight:'900'},
  tabs:{flexDirection:'row',gap:7,paddingHorizontal:10,backgroundColor:p.surfaceSecondary},
  tab:{paddingHorizontal:7,paddingVertical:13},tabText:{fontSize:12,color:p.textSecondary,fontWeight:'600'},
  keypad:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:7,marginTop:2},
  key:{width:'31.9%',height:65,backgroundColor:p.surfaceSecondary,borderRadius:13,alignItems:'center',justifyContent:'center'},
  keyText:{color:p.text,fontSize:24,fontWeight:'600'},
  modal:{flex:1,backgroundColor:'rgba(0,0,0,.55)',justifyContent:'flex-end'},
  sheet:{backgroundColor:p.surface,borderTopLeftRadius:24,borderTopRightRadius:24,padding:18,paddingBottom:45,gap:12,maxHeight:670},
  handle:{height:5,width:43,borderRadius:10,backgroundColor:p.border,alignSelf:'center'},
  sheetRow:{flexDirection:'row',alignItems:'center',gap:12,minHeight:54,borderBottomWidth:1,borderBottomColor:p.border,paddingVertical:8},
  editKinds:{flexDirection:'row',gap:8},kind:{flex:1,borderColor:p.border,borderWidth:1,borderRadius:9,paddingVertical:12,paddingHorizontal:6,alignItems:'center'},
  yellowButton:{minHeight:48,backgroundColor:'#FACC15',borderRadius:10,alignItems:'center',justifyContent:'center',padding:11},
  yellowText:{color:'#111827',fontWeight:'900',fontSize:14},
});