import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { rmaApi, type B2BLedgerContact, type B2BLedgerKind, type B2BLedgerWallet, type LedgerReport, type B2BLedgerNote } from '@/lib/api';
import { appAlert } from '@/lib/appAlert';

const YELLOW='#FACC15';
const BG='#0D0E10';
const CARD='#18191B';
const CARD_INNER='#242528';
const BORDER='#343538';
const WHITE='#F8F8F9';
const MUTED='#A6ABB7';
const GREEN='#4CE3B2';
const RED='#F05A68';
const INITIAL:LedgerReport={today_in:'0',today_out:'0',month_in:'0',month_out:'0',all_out:'0',cash_cents:'0',bank_cents:'0',cash_in:'0',cash_out:'0',contacts:0,wallets:0};
const money=(cents:unknown)=> (Number(cents||0)/100).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₺';
const net=(c:B2BLedgerContact)=>BigInt(c.receivable_balance_cents||'0')-BigInt(c.debt_balance_cents||'0');
type AccountType='cari'|'cash'|'bank';

export default function DefterHome() {
  const router=useRouter();
  const styles=useMemo(()=>makeStyles(),[]);
  const [contacts,setContacts]=useState<B2BLedgerContact[]>([]);
  const [wallets,setWallets]=useState<B2BLedgerWallet[]>([]);
  const [report,setReport]=useState<LedgerReport>(INITIAL);
  const [notes,setNotes]=useState<B2BLedgerNote[]>([]);
  const [company,setCompany]=useState('Defterim');
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  const [searchOpen,setSearchOpen]=useState(false),[search,setSearch]=useState('');
  const [createOpen,setCreateOpen]=useState(false),[noteOpen,setNoteOpen]=useState(false),[reportOpen,setReportOpen]=useState(false);
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

  const openCreate=(type:AccountType='cari')=>{
    setAccountType(type);
    setCreateOpen(true);
  };
  const goWallet=(wallet:B2BLedgerWallet)=>router.push({
    pathname:'/ledger/wallet/[id]',params:{id:wallet.id}
  } as never);
  const goContact=(contact:B2BLedgerContact)=>router.push({
    pathname:'/ledger/[id]',params:{id:contact.id}
  } as never);
  const walletRow=(wallet:B2BLedgerWallet)=> {
    const balance=BigInt(wallet.balance_cents||'0');
    return <Pressable key={wallet.id} onPress={()=>goWallet(wallet)}
      accessibilityRole="button" accessibilityLabel={wallet.name+', bakiye '+money(wallet.balance_cents)}
      style={({pressed})=>[styles.accountRow,pressed&&styles.pressed]}>
      <View style={styles.rowIcon}>
        <Ionicons name={wallet.kind==='cash'?'wallet-outline':'business-outline'}
          size={21} color={wallet.kind==='cash'?WHITE:YELLOW}/>
      </View>
      <Text style={styles.accountName} numberOfLines={1}>{wallet.name}</Text>
      <Text style={[styles.accountBalance,{color:balance>0n?GREEN:balance<0n?RED:WHITE}]}>
        {money(wallet.balance_cents)}
      </Text>
      <Ionicons name="chevron-forward" size={22} color={YELLOW}/>
    </Pressable>;
  };
  const reportLine=(label:string,value:string,negative=false)=>
    <View style={styles.summaryLine}>
      <Text style={styles.summaryKey}>{label}</Text>
      <Text style={[styles.summaryValue,negative&&{color:RED}]}>{value}</Text>
    </View>;
  const accountTitle=(icon:'wallet-outline'|'business-outline'|'people-outline',
    title:string,add?:()=>void,count?:string)=>
    <View style={styles.sectionHeading}>
      <View style={styles.sectionTitleGroup}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} color={YELLOW} size={27}/>
        </View>
        <Text style={styles.sectionHeadingText}>{title}</Text>
      </View>
      {add?(
        <Pressable accessibilityRole="button" accessibilityLabel={'Yeni '+title+' hesabı ekle'}
          onPress={add} style={({pressed})=>[styles.sectionAdd,pressed&&styles.pressed]}>
          <Ionicons name="add" color={YELLOW} size={29}/>
        </Pressable>
      ):<Text style={styles.sectionCount}>{count}</Text>}
    </View>;
  return <Screen style={{backgroundColor:BG}}>
    <View style={styles.header}>
      <Pressable onPress={()=>router.back()} accessibilityRole="button"
        accessibilityLabel="Geri" style={({pressed})=>[styles.headerTool,pressed&&styles.pressed]}>
        <Ionicons name="chevron-back" size={28} color={YELLOW}/>
      </Pressable>
      <Text style={styles.company} numberOfLines={1}>{company}</Text>
      <Pressable onPress={()=>setSearchOpen(v=>!v)} accessibilityRole="button"
        accessibilityLabel="Hesap ara" style={({pressed})=>[styles.headerTool,pressed&&styles.pressed]}>
        <Ionicons name={searchOpen?'close':'search'} color={YELLOW} size={26}/>
      </Pressable>
      <Pressable onPress={()=>openCreate()} accessibilityRole="button"
        accessibilityLabel="Yeni hesap oluştur" style={({pressed})=>[styles.headerAdd,pressed&&styles.pressed]}>
        <Ionicons name="add" color="#121212" size={32}/>
      </Pressable>
    </View>
    {searchOpen?(
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={19} color={YELLOW}/>
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
          placeholder="Cari, banka, kasa ara…" placeholderTextColor={MUTED}
          accessibilityLabel="Defter hesaplarında ara" autoFocus/>
        {search.length>0?<Pressable accessibilityLabel="Aramayı temizle"
            onPress={()=>setSearch('')}><Ionicons name="close-circle" size={20} color={MUTED}/></Pressable>:null}
      </View>
    ):null}
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)} tintColor={YELLOW}/>}>
      <View style={styles.shortcuts}>
        <Pressable onPress={()=>setNoteOpen(true)} accessibilityRole="button"
          style={({pressed})=>[styles.shortcut,pressed&&styles.pressed]}>
          <View style={styles.shortcutIcon}>
            <Ionicons name="document-text-outline" color={YELLOW} size={27}/>
          </View>
          <Text style={styles.shortcutText} numberOfLines={1}>Notlar ({notes.length})</Text>
          <Ionicons name="chevron-forward" size={23} color={YELLOW}/>
        </Pressable>
        <Pressable onPress={()=>setReportOpen(v=>!v)} accessibilityRole="button"
          accessibilityState={{expanded:reportOpen}}
          style={({pressed})=>[styles.shortcut,pressed&&styles.pressed]}>
          <View style={styles.shortcutIcon}>
            <Ionicons name="stats-chart" color={YELLOW} size={27}/>
          </View>
          <Text style={styles.shortcutText} numberOfLines={1}>Raporlar</Text>
          <Ionicons name={reportOpen?'chevron-up':'chevron-down'} color={YELLOW} size={23}/>
        </Pressable>
      </View>
      {error?<Pressable onPress={()=>void load(true)} style={styles.errorBox}
        accessibilityRole="button"><Text style={styles.error}>{error} · Tekrar dene</Text></Pressable>:null}
      {loading?<ActivityIndicator color={YELLOW} style={{paddingVertical:14}}/>:null}
      {reportOpen?<View style={styles.reportCard}>
        <View style={styles.reportHeading}>
          <Ionicons name="analytics-outline" size={22} color={YELLOW}/>
          <Text style={styles.reportTitle}>Finansal Raporlar</Text>
          <Pressable onPress={()=>setReportOpen(false)} accessibilityLabel="Raporları kapat">
            <Ionicons name="close-outline" size={21} color={MUTED}/>
          </Pressable>
        </View>
        <Text style={styles.reportSubTitle}>Bugünkü işlemler</Text>
        {reportLine('Tahsilatlar',money(report.today_in))}
        {reportLine('Ödemeler',money(report.today_out),true)}
        {reportLine('Net hareket',money((BigInt(report.today_in)-BigInt(report.today_out)).toString()))}
        <View style={styles.separator}/>
        <Text style={styles.reportSubTitle}>Toplam gider</Text>
        {reportLine('Tüm kayıtlı ödemeler',money(report.all_out),true)}
        <View style={styles.separator}/>
        <Text style={styles.reportSubTitle}>Son 30 gün</Text>
        {reportLine('Tahsilatlar',money(report.month_in))}
        {reportLine('Ödemeler',money(report.month_out),true)}
        <View style={styles.separator}/>
        <Text style={styles.reportSubTitle}>Kasa ve banka</Text>
        {reportLine('Kasaya giriş',money(report.cash_in))}
        {reportLine('Kasadan çıkış',money(report.cash_out),true)}
        {reportLine('Kasa bakiyesi',money(report.cash_cents))}
        {reportLine('Banka bakiyesi',money(report.bank_cents))}
        <Text style={styles.reportInfo}>
          Nakit bazlı rapordur. Tahsilat veya ödeme yapılmamış alış ve satışlar gelir-gider sayılmaz.
        </Text>
      </View>:null}
      <View style={styles.section}>
        {accountTitle('wallet-outline','NAKİT (KASA)',()=>openCreate('cash'))}
        {cash.length?(
          <View style={styles.sectionList}>{cash.map(walletRow)}</View>
        ):<Text style={styles.empty}>Kasa hesabı bulunmuyor. + ile oluştur.</Text>}
      </View>
      <View style={styles.section}>
        {accountTitle('business-outline','BANKA HESAPLARI',()=>openCreate('bank'))}
        {banks.length?(
          <View style={styles.sectionList}>{banks.map(walletRow)}</View>
        ):<Text style={styles.empty}>Banka hesabı bulunmuyor. + ile oluştur.</Text>}
      </View>
      <View style={styles.section}>
        {accountTitle('people-outline','CARİ (BORÇ / ALACAK)',undefined,current.length+' hesap')}
        {current.length?<View style={styles.sectionList}>{current.map(contact=>{
          const balance=net(contact);
          return <Pressable key={contact.id} onPress={()=>goContact(contact)}
            accessibilityRole="button"
            accessibilityLabel={contact.name+', bakiye '+money(balance.toString())}
            style={({pressed})=>[styles.accountRow,pressed&&styles.pressed]}>
            <View style={styles.rowIcon}>
              <Ionicons name="person-outline" color={WHITE} size={22}/>
            </View>
            <Text numberOfLines={1} style={styles.accountName}>{contact.name}</Text>
            <Text style={[styles.accountBalance,{color:balance>0n?RED:balance<0n?WHITE:WHITE}]}>
              {money(balance.toString())}
            </Text>
            <Ionicons name="chevron-forward" size={22} color={YELLOW}/>
          </Pressable>;
        })}</View>:<Text style={styles.empty}>Cari hesap bulunmuyor.</Text>}
      </View>
      <Pressable onPress={()=>router.push('/ledger/import' as never)}
        accessibilityRole="button" accessibilityLabel="PDF'den eski hesapları içe aktar"
        style={({pressed})=>[styles.importButton,pressed&&styles.pressed]}>
        <View style={styles.importIcon}>
          <Ionicons name="document-attach-outline" color={YELLOW} size={28}/>
        </View>
        <Text numberOfLines={2} style={styles.importText}>PDF'den eski hesapları içe aktar</Text>
        <Ionicons name="chevron-forward" size={26} color={YELLOW}/>
      </Pressable>
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={22} color={YELLOW}/>
        <Text style={styles.disclaimerText}>Defterim, işletme içi takip içindir; resmî e-Defter değildir.</Text>
      </View>
    </ScrollView>

    <Modal visible={createOpen} transparent animationType="slide" onRequestClose={()=>setCreateOpen(false)}>
      <View style={styles.overlay}><Pressable style={{flex:1}} onPress={()=>setCreateOpen(false)}/>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheet}>
          <View style={styles.handle}/><Text style={styles.title}>Yeni Hesap</Text>
          <Text style={styles.label}>Hesap tipi</Text>
          <View style={styles.types}>{([{id:'cari',label:'Cari'},{id:'bank',label:'Banka'},{id:'cash',label:'Kasa'}] as const).map(t=>
            <Pressable key={t.id} onPress={()=>setAccountType(t.id)} style={[styles.typeItem,accountType===t.id&&styles.typeActive]}><Text style={[styles.typeLabel,{color:WHITE}]}>{t.label}</Text></Pressable>
          )}</View>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Hesap adı *" placeholderTextColor={MUTED} maxLength={140}/>
          {accountType==='cari'?<>
            <View style={styles.types}>{([{id:'supplier',label:'Tedarikçi'},{id:'customer',label:'Müşteri'},{id:'other',label:'Diğer'}] as const).map(t=>
              <Pressable key={t.id} onPress={()=>setKind(t.id)} style={[styles.typeItem,kind===t.id&&styles.typeActive]}><Text style={[styles.typeLabel,{color:WHITE}]}>{t.label}</Text></Pressable>
            )}</View>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Telefon (isteğe bağlı)" placeholderTextColor={MUTED} keyboardType="phone-pad"/>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Adres (isteğe bağlı)" placeholderTextColor={MUTED}/>
            <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Açıklama" placeholderTextColor={MUTED}/>
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
            placeholder="Yeni iş notu..." placeholderTextColor={MUTED} maxLength={4000}/>
          <Pressable style={styles.primary} disabled={busy||!noteText.trim()} onPress={()=>void addNote()}><Text style={styles.primaryText}>Notu kaydet</Text></Pressable>
          {notes.map(n=><View key={n.id} style={styles.note}><Text style={{color:WHITE}}>{n.content}</Text><Pressable
            onPress={async()=>{try{await rmaApi.deleteB2BLedgerNote(n.id);await load(true)}catch(e){appAlert('Hata',String(e))}}}>
            <Ionicons name="trash-outline" color="#EF5543" size={19}/></Pressable></View>)}
        </ScrollView>
      </View>
    </Modal>
  </Screen>;
}

const makeStyles=()=>StyleSheet.create({
  header:{
    height:76,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:10,
    backgroundColor:BG,
  },
  company:{
    flex:1,fontWeight:'500',fontSize:24,color:WHITE,textAlign:'center',
    letterSpacing:-0.5,
  },
  headerTool:{
    width:47,height:47,borderRadius:24,backgroundColor:'#151617',
    borderWidth:1,borderColor:'#50431A',alignItems:'center',justifyContent:'center',
  },
  headerAdd:{
    width:49,height:49,borderRadius:25,backgroundColor:YELLOW,
    alignItems:'center',justifyContent:'center',
    shadowColor:YELLOW,shadowOpacity:0.25,shadowRadius:10,
    shadowOffset:{width:0,height:3},elevation:4,
  },
  pressed:{opacity:0.72,transform:[{scale:0.99}]},
  searchWrap:{
    flexDirection:'row',alignItems:'center',gap:10,marginHorizontal:17,
    borderRadius:14,borderWidth:1,borderColor:BORDER,
    backgroundColor:CARD,paddingHorizontal:13,minHeight:48,
  },
  searchInput:{flex:1,color:WHITE,fontSize:14,paddingVertical:10},
  page:{paddingTop:14,paddingHorizontal:16,paddingBottom:78,gap:15},
  shortcuts:{flexDirection:'row',gap:10},
  shortcut:{
    flex:1,minHeight:86,borderRadius:18,backgroundColor:CARD,
    borderWidth:1,borderColor:BORDER,flexDirection:'row',alignItems:'center',
    paddingHorizontal:12,gap:10,
  },
  shortcutIcon:{
    width:43,height:43,borderRadius:13,backgroundColor:'#302A12',
    alignItems:'center',justifyContent:'center',
  },
  shortcutText:{color:WHITE,flex:1,fontWeight:'500',fontSize:13},
  section:{
    backgroundColor:CARD,borderWidth:1,borderColor:BORDER,
    borderRadius:21,paddingHorizontal:15,paddingTop:14,paddingBottom:15,
    shadowColor:'#000',shadowOpacity:0.17,shadowRadius:8,
    shadowOffset:{width:0,height:3},elevation:2,
  },
  sectionHeading:{
    minHeight:61,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10,
  },
  sectionTitleGroup:{flex:1,flexDirection:'row',alignItems:'center',gap:13},
  sectionIcon:{
    width:45,height:45,borderRadius:12,backgroundColor:'#39320E',
    alignItems:'center',justifyContent:'center',
  },
  sectionHeadingText:{fontWeight:'500',color:WHITE,fontSize:15,flexShrink:1,letterSpacing:0.15},
  sectionAdd:{
    width:39,height:39,borderRadius:22,borderWidth:1.3,borderColor:YELLOW,
    justifyContent:'center',alignItems:'center',
  },
  sectionCount:{color:MUTED,fontSize:13},
  sectionList:{paddingTop:8},
  empty:{fontSize:13,color:MUTED,marginLeft:58,marginTop:2,marginBottom:4,lineHeight:21},
  accountRow:{
    flexDirection:'row',minHeight:68,alignItems:'center',gap:11,
    borderTopWidth:1,borderTopColor:BORDER,paddingVertical:8,
  },
  rowIcon:{
    width:42,height:42,borderRadius:12,backgroundColor:CARD_INNER,
    justifyContent:'center',alignItems:'center',
  },
  accountName:{flex:1,minWidth:0,color:WHITE,fontSize:15,fontWeight:'400'},
  accountBalance:{fontWeight:'400',fontSize:16,fontVariant:['tabular-nums']},
  importButton:{
    minHeight:80,borderRadius:20,borderColor:YELLOW,borderWidth:1,
    backgroundColor:'#24200E',flexDirection:'row',alignItems:'center',
    paddingHorizontal:15,gap:13,
  },
  importIcon:{
    width:47,height:47,borderRadius:13,backgroundColor:'#51430D',
    alignItems:'center',justifyContent:'center',
  },
  importText:{color:WHITE,flex:1,fontSize:14,fontWeight:'500'},
  disclaimer:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,marginTop:11},
  disclaimerText:{fontSize:11,color:MUTED,flexShrink:1},
  reportCard:{
    borderRadius:18,padding:16,gap:7,backgroundColor:CARD,borderWidth:1,borderColor:BORDER,
  },
  reportHeading:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:5},
  reportTitle:{flex:1,color:WHITE,fontWeight:'500',fontSize:17},
  reportSubTitle:{fontWeight:'500',fontSize:14,color:WHITE,marginTop:7},
  summaryLine:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:32,gap:10},
  summaryKey:{color:MUTED,flex:1,fontSize:12},
  summaryValue:{color:WHITE,fontSize:13,fontWeight:'500',fontVariant:['tabular-nums']},
  separator:{height:1,backgroundColor:BORDER,marginVertical:6},
  reportInfo:{fontSize:11,lineHeight:18,color:MUTED,marginTop:8},
  errorBox:{backgroundColor:'#341B20',borderRadius:12,padding:14,borderWidth:1,borderColor:'#8F3943'},
  error:{color:'#FFC4C9',fontSize:12},
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.74)',justifyContent:'flex-end'},
  sheet:{
    backgroundColor:'#1B1C1F',borderTopLeftRadius:27,borderTopRightRadius:27,
    borderWidth:1,borderColor:BORDER,paddingHorizontal:19,paddingTop:15,paddingBottom:48,
    gap:13,maxHeight:700,
  },
  handle:{height:5,width:45,borderRadius:10,backgroundColor:'#54565A',alignSelf:'center',marginBottom:5},
  title:{color:WHITE,fontWeight:'400',fontSize:22},
  label:{color:MUTED,fontSize:12},
  types:{flexDirection:'row',gap:8},
  typeItem:{
    flex:1,minHeight:44,alignItems:'center',justifyContent:'center',
    borderRadius:11,borderWidth:1,borderColor:BORDER,backgroundColor:CARD,
  },
  typeActive:{borderColor:YELLOW,borderWidth:1.5,backgroundColor:'#3A3213'},
  typeLabel:{fontSize:12,color:WHITE,fontWeight:'500'},
  input:{
    minHeight:47,color:WHITE,borderColor:BORDER,borderWidth:1,borderRadius:12,
    backgroundColor:'#101113',paddingHorizontal:13,paddingVertical:11,
  },
  primary:{
    backgroundColor:YELLOW,borderRadius:13,minHeight:49,
    alignItems:'center',justifyContent:'center',paddingHorizontal:14,
  },
  primaryText:{color:'#121212',fontSize:14,fontWeight:'400'},
  note:{
    flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,
    borderBottomWidth:1,borderBottomColor:BORDER,paddingVertical:12,
  },
});
