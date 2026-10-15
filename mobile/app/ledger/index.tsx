import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { rmaApi, type B2BLedgerContact, type B2BLedgerKind, type B2BLedgerWallet, type LedgerReport, type B2BLedgerNote } from '@/lib/api';
import { appAlert } from '@/lib/appAlert';

const YELLOW='#FACC15';
const INITIAL:LedgerReport={today_in:'0',today_out:'0',month_in:'0',month_out:'0',all_out:'0',cash_cents:'0',bank_cents:'0',contacts:0,wallets:0};
const money=(cents:unknown)=> (Number(cents||0)/100).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₺';
const net=(c:B2BLedgerContact)=>BigInt(c.receivable_balance_cents||'0')-BigInt(c.debt_balance_cents||'0');
type AccountType='cari'|'cash'|'bank';

export default function DefterHome() {
  const router=useRouter();
  const {palette}=useAppearance();
  const styles=useMemo(()=>makeStyles(palette),[palette]);
  const [contacts,setContacts]=useState<B2BLedgerContact[]>([]);
  const [wallets,setWallets]=useState<B2BLedgerWallet[]>([]);
  const [report,setReport]=useState<LedgerReport>(INITIAL);
  const [notes,setNotes]=useState<B2BLedgerNote[]>([]);
  const [company,setCompany]=useState('Defterim');
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  const [searchOpen,setSearchOpen]=useState(false),[search,setSearch]=useState('');
  const [createOpen,setCreateOpen]=useState(false),[noteOpen,setNoteOpen]=useState(false),[reportOpen,setReportOpen]=useState(true);
  const [accountType,setAccountType]=useState<AccountType>('cari');
  const [name,setName]=useState(''),[phone,setPhone]=useState(''),[address,setAddress]=useState(''),[description,setDescription]=useState('');
  const [kind,setKind]=useState<B2BLedgerKind>('supplier'),[noteText,setNoteText]=useState('');
  const load=useCallback(async(refresh=false)=>{
    if(refresh)setRefreshing(true);else setLoading(true);
    try{
      const [people,balances,stats,memos,account]=await Promise.all([
        rmaApi.listB2BLedgerContacts(),rmaApi.listB2BLedgerWallets(),rmaApi.getLedgerReports(),
        rmaApi.getLedgerGlobalNotes(),rmaApi.getB2BAccount().catch(()=>null),
      ]);
      setContacts(people);setWallets(balances);setReport(stats);setNotes(memos);
      setCompany(account?.companyName?.trim()||'Defterim');
      setError('');
    }catch(e){setError(e instanceof Error?e.message:'Defter verileri alınamadı');}
    finally{setLoading(false);setRefreshing(false);}
  },[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  const needle=search.trim().toLocaleLowerCase('tr-TR');
  const match=(v:string)=>!needle||v.toLocaleLowerCase('tr-TR').includes(needle);
  const cash=wallets.filter(w=>w.kind==='cash'&&match(w.name));
  const banks=wallets.filter(w=>w.kind==='bank'&&match(w.name));
  const current=contacts.filter(c=>match(c.name)||match(c.phone||''));
  async function create(){
    if(!name.trim()||busy){appAlert('Hesap adı','Hesap adı girin.');return;}
    setBusy(true);
    try{
      if(accountType==='cari'){
        const c=await rmaApi.createB2BLedgerContact({name:name.trim(),kind,phone:phone.trim(),address:address.trim(),description:description.trim()});
        setCreateOpen(false);router.push({pathname:'/ledger/[id]',params:{id:c.id}} as never);
      }else{
        const w=await rmaApi.createLedgerWallet(name.trim(),accountType);
        setCreateOpen(false);router.push({pathname:'/ledger/wallet/[id]',params:{id:w.id}} as never);
      }
      setName('');setPhone('');setAddress('');setDescription('');
      await load(true);
    }catch(e){appAlert('Hesap oluşturulamadı',e instanceof Error?e.message:'Tekrar deneyin',undefined,'error');}
    finally{setBusy(false);}
  }
  async function addNote(){
    if(!noteText.trim()||busy)return;
    setBusy(true);
    try{await rmaApi.addLedgerGlobalNote(noteText.trim());setNoteText('');await load(true);}
    catch(e){appAlert('Not eklenemedi',e instanceof Error?e.message:'Tekrar deneyin',undefined,'error');}
    finally{setBusy(false);}
  }
  const row=(wallet:B2BLedgerWallet)=>{
    const positive=BigInt(wallet.balance_cents)>=0n;
    return <Pressable key={wallet.id} onPress={()=>router.push({pathname:'/ledger/wallet/[id]',params:{id:wallet.id}} as never)}
      style={styles.accountRow}>
      <Ionicons name={wallet.kind==='cash'?'wallet-outline':'business-outline'} size={21} color={palette.textSecondary}/>
      <Text style={styles.accountName} numberOfLines={1}>{wallet.name}</Text>
      <Text style={[styles.accountBalance,{color:positive?palette.text:'#EF5543'}]}>{money(wallet.balance_cents)}</Text>
      <Ionicons name="chevron-forward" size={17} color={palette.muted}/>
    </Pressable>;
  };
  const line=(label:string,value:string,red=false)=><View style={styles.summaryLine}><Text style={styles.summaryKey}>{label}</Text><Text style={[styles.summaryValue,red&&{color:'#EF5543'}]}>{value}</Text></View>;
  return <Screen style={{backgroundColor:palette.background}}>
    <View style={styles.header}>
      <Pressable onPress={()=>router.back()} accessibilityLabel="Geri" style={styles.tool}><Ionicons name="chevron-back" size={25} color={palette.text}/></Pressable>
      <Text style={styles.company} numberOfLines={1}>{company}</Text>
      <Pressable onPress={()=>setSearchOpen(v=>!v)} accessibilityLabel="Hesap ara" style={styles.tool}><Ionicons name="search" color={palette.text} size={24}/></Pressable>
      <Pressable onPress={()=>setCreateOpen(true)} accessibilityLabel="Yeni hesap" style={styles.tool}><Ionicons name="add" color={palette.text} size={30}/></Pressable>
    </View>
    {searchOpen?<TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Cari, kasa, banka ara..."
      placeholderTextColor={palette.muted} autoFocus/>:null}
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)} tintColor={palette.text}/>}>
      <View style={styles.shortcuts}>
        <Pressable onPress={()=>setNoteOpen(true)} style={styles.shortcut}><Ionicons name="document-text-outline" color={palette.text} size={20}/><Text style={styles.shortcutText}>Notlar ({notes.length})</Text></Pressable>
        <Pressable onPress={()=>setReportOpen(v=>!v)} style={styles.shortcut}><Ionicons name="stats-chart-outline" color={palette.text} size={20}/><Text style={styles.shortcutText}>Raporlar</Text><Ionicons name={reportOpen?'chevron-up':'chevron-down'} color={palette.muted} size={16}/></Pressable>
      </View>
      {error?<Pressable style={styles.card} onPress={()=>void load(true)}><Text style={styles.error}>{error} · Tekrar dene</Text></Pressable>:null}
      {loading?<ActivityIndicator color={YELLOW}/>:null}
      {reportOpen?<View style={styles.card}>
        <Text style={styles.sectionTitle}>Bugünkü işlem durumu</Text>
        {line('Bugünkü tahsilat',money(report.today_in))}
        {line('Bugünkü ödeme',money(report.today_out),true)}
        {line('Bugünkü net nakit hareketi',money((BigInt(report.today_in)-BigInt(report.today_out)).toString()))}
        <View style={styles.separator}/>
        <Text style={styles.sectionTitle}>Toplam genel gider</Text>
        {line('Tüm kayıtlı ödemeler',money(report.all_out),true)}
        <View style={styles.separator}/>
        <Text style={styles.sectionTitle}>Son 30 gün</Text>
        {line('Gelir / tahsilat',money(report.month_in))}
        {line('Gider / ödeme',money(report.month_out),true)}
        <View style={styles.separator}/>
        <Text style={styles.sectionTitle}>Kasa ve banka özeti</Text>
        {line('Kasa bakiyesi',money(report.cash_cents))}
        {line('Banka bakiyesi',money(report.bank_cents))}
        <Text style={styles.small}>Bu rapor nakit bazlıdır. Alış ve satış tutarları tahsilat/ödeme gerçekleşene kadar gelir-gider sayılmaz.</Text>
      </View>:null}
      <View style={styles.section}>
        <View style={styles.sectionHeading}><Text style={styles.sectionHeadingText}>NAKİT (KASA)</Text><Pressable onPress={()=>{setAccountType('cash');setCreateOpen(true)}}><Ionicons name="add-circle-outline" size={22} color={palette.text}/></Pressable></View>
        {cash.length?cash.map(row):<Text style={styles.small}>Kasa hesabı bulunmuyor. + ile oluştur.</Text>}
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeading}><Text style={styles.sectionHeadingText}>BANKA HESAPLARI</Text><Pressable onPress={()=>{setAccountType('bank');setCreateOpen(true)}}><Ionicons name="add-circle-outline" size={22} color={palette.text}/></Pressable></View>
        {banks.length?banks.map(row):<Text style={styles.small}>Banka hesabı eklenmedi.</Text>}
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeading}><Text style={styles.sectionHeadingText}>CARİ (BORÇ / ALACAK)</Text><Text style={styles.small}>{current.length} hesap</Text></View>
        {current.length?current.map(c=>{
          // Signed view: receivable positive (red), payable/debt negative (white).
          const balance=net(c),receivable=balance>0n;
          return <Pressable key={c.id} onPress={()=>router.push({pathname:'/ledger/[id]',params:{id:c.id}} as never)} style={styles.accountRow}>
            <Text style={[styles.accountName,{color:receivable?'#EF5543':palette.text}]} numberOfLines={1}>{c.name}</Text>
            <Text style={[styles.accountBalance,{color:receivable?'#EF5543':palette.text}]}>{money(balance.toString())}</Text>
            <Ionicons name="chevron-forward" color={palette.muted} size={18}/>
          </Pressable>;
        }):<Text style={styles.small}>Cari hesap bulunmuyor.</Text>}
      </View>
      <Pressable style={styles.importButton} onPress={()=>router.push('/ledger/import' as never)}>
        <Ionicons name="document-attach-outline" size={20} color={palette.text}/><Text style={styles.shortcutText}>PDF'den eski hesapları içe aktar</Text>
      </Pressable>
      <Text style={[styles.small,{textAlign:'center'}]}>Defterim, işletme içi takip içindir; resmî e-Defter değildir.</Text>
    </ScrollView>

    <Modal visible={createOpen} transparent animationType="slide" onRequestClose={()=>setCreateOpen(false)}>
      <View style={styles.overlay}><Pressable style={{flex:1}} onPress={()=>setCreateOpen(false)}/>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheet}>
          <View style={styles.handle}/><Text style={styles.title}>Yeni Hesap</Text>
          <Text style={styles.label}>Hesap tipi</Text>
          <View style={styles.types}>{([{id:'cari',label:'Cari'},{id:'bank',label:'Banka'},{id:'cash',label:'Kasa'}] as const).map(t=>
            <Pressable key={t.id} onPress={()=>setAccountType(t.id)} style={[styles.typeItem,accountType===t.id&&styles.typeActive]}><Text style={[styles.typeLabel,{color:palette.text}]}>{t.label}</Text></Pressable>
          )}</View>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Hesap adı *" placeholderTextColor={palette.muted} maxLength={140}/>
          {accountType==='cari'?<>
            <View style={styles.types}>{([{id:'supplier',label:'Tedarikçi'},{id:'customer',label:'Müşteri'},{id:'other',label:'Diğer'}] as const).map(t=>
              <Pressable key={t.id} onPress={()=>setKind(t.id)} style={[styles.typeItem,kind===t.id&&styles.typeActive]}><Text style={[styles.typeLabel,{color:palette.text}]}>{t.label}</Text></Pressable>
            )}</View>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Telefon (isteğe bağlı)" placeholderTextColor={palette.muted} keyboardType="phone-pad"/>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Adres (isteğe bağlı)" placeholderTextColor={palette.muted}/>
            <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Açıklama" placeholderTextColor={palette.muted}/>
          </>:null}
          <Pressable style={styles.primary} disabled={busy||!name.trim()} onPress={()=>void create()}>
            <Text style={styles.primaryText}>{busy?'Kaydediliyor...':'Hesap oluştur'}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
    <Modal visible={noteOpen} transparent animationType="slide" onRequestClose={()=>setNoteOpen(false)}>
      <View style={styles.overlay}><Pressable style={{flex:1}} onPress={()=>setNoteOpen(false)}/>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheet}>
          <View style={styles.handle}/><Text style={styles.title}>Notlar</Text>
          <TextInput multiline style={[styles.input,{minHeight:84}]} value={noteText} onChangeText={setNoteText}
            placeholder="Yeni iş notu..." placeholderTextColor={palette.muted} maxLength={4000}/>
          <Pressable style={styles.primary} disabled={busy||!noteText.trim()} onPress={()=>void addNote()}><Text style={styles.primaryText}>Notu kaydet</Text></Pressable>
          {notes.map(n=><View key={n.id} style={styles.note}><Text style={{color:palette.text}}>{n.content}</Text><Pressable
            onPress={async()=>{try{await rmaApi.deleteB2BLedgerNote(n.id);await load(true)}catch(e){appAlert('Hata',String(e))}}}>
            <Ionicons name="trash-outline" color="#EF5543" size={19}/></Pressable></View>)}
        </ScrollView>
      </View>
    </Modal>
  </Screen>;
}
const makeStyles=(p:AppPalette)=>StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:12,height:62,backgroundColor:p.surface,gap:5,borderBottomWidth:1,borderBottomColor:p.border},
  company:{flex:1,color:p.text,fontSize:18,fontWeight:'900',textAlign:'center'},tool:{width:42,height:42,alignItems:'center',justifyContent:'center'},
  searchInput:{color:p.text,borderBottomWidth:1,borderBottomColor:p.border,paddingHorizontal:16,minHeight:48},
  page:{gap:15,paddingHorizontal:16,paddingBottom:90,paddingTop:15},
  shortcuts:{flexDirection:'row',gap:10},shortcut:{flex:1,borderRadius:13,padding:14,backgroundColor:p.surface,borderWidth:1,borderColor:p.border,flexDirection:'row',gap:9,alignItems:'center'},
  shortcutText:{color:p.text,fontWeight:'700',fontSize:12,flexShrink:1},
  card:{backgroundColor:p.surface,borderRadius:14,padding:15,borderWidth:1,borderColor:p.border,gap:8},
  sectionTitle:{color:p.text,fontSize:14,fontWeight:'900',marginTop:2},
  summaryLine:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',minHeight:32,gap:8},
  summaryKey:{color:p.textSecondary,fontSize:12,flex:1},summaryValue:{color:p.text,fontSize:13,fontWeight:'800'},
  separator:{height:1,backgroundColor:p.border,marginVertical:6},
  section:{borderRadius:14,backgroundColor:p.surface,paddingVertical:4,paddingHorizontal:12,borderWidth:1,borderColor:p.border},
  sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:48,marginHorizontal:2},
  sectionHeadingText:{fontSize:12,fontWeight:'900',color:p.textSecondary},
  accountRow:{minHeight:60,borderTopWidth:1,borderTopColor:p.border,flexDirection:'row',alignItems:'center',gap:9,paddingVertical:8},
  accountName:{flex:1,color:p.text,fontSize:15,fontWeight:'600'},accountBalance:{fontSize:16,fontWeight:'800'},
  small:{color:p.textSecondary,fontSize:11,lineHeight:17,paddingBottom:6},error:{color:'#EF5543'},
  importButton:{backgroundColor:p.surface,padding:14,borderRadius:12,borderColor:p.border,borderWidth:1,flexDirection:'row',gap:9,alignItems:'center'},
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.55)',justifyContent:'flex-end'},
  sheet:{backgroundColor:p.surface,borderTopLeftRadius:26,borderTopRightRadius:26,padding:18,gap:13,paddingBottom:50,maxHeight:700},
  handle:{height:5,width:45,borderRadius:10,backgroundColor:p.border,alignSelf:'center',marginBottom:7},
  title:{color:p.text,fontSize:21,fontWeight:'900'},label:{color:p.textSecondary,fontSize:12},
  types:{flexDirection:'row',gap:8},typeItem:{flex:1,alignItems:'center',borderColor:p.border,borderWidth:1,borderRadius:9,paddingVertical:11},
  typeActive:{borderColor:YELLOW,borderWidth:2,backgroundColor:p.surfaceSecondary},typeLabel:{fontSize:12,fontWeight:'800'},
  input:{borderRadius:11,borderWidth:1,borderColor:p.border,color:p.text,backgroundColor:p.background,minHeight:46,paddingHorizontal:12,paddingVertical:10},
  primary:{backgroundColor:YELLOW,padding:14,borderRadius:11,minHeight:48,alignItems:'center',justifyContent:'center'},
  primaryText:{color:'#111827',fontSize:14,fontWeight:'900'},
  note:{flexDirection:'row',gap:9,padding:12,borderBottomWidth:1,borderBottomColor:p.border,justifyContent:'space-between'},
});