import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { rmaApi, type B2BLedgerContact, type B2BLedgerKind, type B2BLedgerOverview, type B2BLedgerWallet } from '@/lib/api';
import { appAlert } from '@/lib/appAlert';
import { radius, spacing } from '@/constants/theme';

const EMPTY = { contact_count: 0, debt_balance_cents: '0', receivable_balance_cents: '0' };
function formatCents(value: string | number | null | undefined) {
  const cents = Number(value || 0);
  if (!Number.isFinite(cents)) return '—';
  return (cents / 100).toLocaleString('tr-TR',{ style: 'currency', currency: 'TRY' });
}
const KIND: Record<B2BLedgerKind,string> = {
  supplier: 'Tedarikçi', customer: 'Müşteri', other: 'Diğer',
};

export default function LedgerHome() {
  const router = useRouter();
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette),[palette]);
  const [contacts,setContacts] = useState<B2BLedgerContact[]>([]);
  const [wallets,setWallets] = useState<B2BLedgerWallet[]>([]);
  const [overview,setOverview] = useState<B2BLedgerOverview>(EMPTY);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [formOpen,setFormOpen] = useState(false);
  const [name,setName] = useState('');
  const [kind,setKind] = useState<B2BLedgerKind>('supplier');
  const [phone,setPhone] = useState('');
  const [address,setAddress] = useState('');
  const [description,setDescription] = useState('');
  const [query,setQuery] = useState('');

  const load=useCallback(async(refresh=false) => {
    if(refresh) setRefreshing(true); else setLoading(true);
    try {
      const [rows,totals,accounts] = await Promise.all([
        rmaApi.listB2BLedgerContacts(),rmaApi.getB2BLedgerOverview(),rmaApi.listB2BLedgerWallets(),
      ]);
      setContacts(rows);setOverview(totals);setWallets(accounts);setError('');
    } catch(err) {
      setError(err instanceof Error ? err.message : 'Defterler yüklenemedi');
    } finally {setLoading(false);setRefreshing(false);}
  },[]);
  useFocusEffect(useCallback(()=>{ void load(); },[load]));
  const filtered=useMemo(() => contacts.filter(x=>[x.name,x.phone,x.kind].some(v=>
    String(v||'').toLocaleLowerCase('tr-TR').includes(query.trim().toLocaleLowerCase('tr-TR'))
  )),[contacts,query]);
  async function create() {
    if(busy) return;
    if(!name.trim()) {appAlert('Firma adı gerekli','Defter için firma adı girin.');return;}
    setBusy(true);
    try {
      const created=await rmaApi.createB2BLedgerContact({
        name:name.trim(),kind,phone:phone.trim(),address:address.trim(),description:description.trim(),
      });
      setName('');setPhone('');setAddress('');setDescription('');setKind('supplier');setFormOpen(false);
      await load(true);
      router.push({ pathname:'/ledger/[id]',params:{id:created.id} } as never);
    } catch(err) {
      appAlert('Defter oluşturulamadı',err instanceof Error?err.message:'Tekrar deneyin',undefined,'error');
    } finally {setBusy(false);}
  }
  return <Screen style={{backgroundColor:palette.background}}>
    <View style={styles.header}>
      <Pressable style={styles.back} onPress={()=>router.back()} accessibilityLabel="Hesabıma dön">
        <Ionicons name="chevron-back" size={23} color={palette.text}/>
      </Pressable>
      <Text style={styles.headerTitle}>Defterim</Text>
      <View style={styles.back}/>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)} tintColor={palette.text}/>}>
      <Text style={styles.subtitle}>İşletme hesaplarını ve günlük kayıtlarını tek yerden takip et.</Text>
      <View style={styles.summary}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Toplam alacak bakiyesi</Text>
          <Text style={styles.summaryAmount}>{formatCents(overview.receivable_balance_cents)}</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Toplam borç bakiyesi</Text>
          <Text style={styles.summaryAmount}>{formatCents(overview.debt_balance_cents)}</Text>
        </View>
      </View>
      <View style={styles.metrics}>
        <Ionicons name="book-outline" size={17} color={palette.textSecondary}/>
        <Text style={styles.metricText}>{overview.contact_count} aktif defter</Text>
        <Text style={styles.metricTip}>Tutarlar kendi kayıtlarına dayanır</Text>
      </View>
      <Pressable style={styles.addButton} onPress={()=>setFormOpen(v=>!v)} accessibilityRole="button">
        <Ionicons name={formOpen?'close':'add-circle-outline'} size={21} color="#111827"/>
        <Text style={styles.addButtonText}>{formOpen?'Yeni defteri kapat':'Yeni Defter Oluştur'}</Text>
      </Pressable>
      <Pressable style={[styles.addButton,{backgroundColor:palette.surface,borderWidth:1,borderColor:palette.border}]} onPress={()=>router.push('/ledger/import' as never)} accessibilityRole="button">
        <Ionicons name="document-text-outline" size={20} color={palette.text}/>
        <Text style={[styles.addButtonText,{color:palette.text}]}>PDF'den İçe Aktar</Text>
      </Pressable>
      {formOpen ? <View style={styles.form}>
        <Text style={styles.formHeading}>Firma bilgileri</Text>
        <TextInput style={styles.input} placeholder="Firma / müşteri adı *" placeholderTextColor={palette.muted} value={name} onChangeText={setName} maxLength={140}/>
        <View style={styles.options}>
          {(['supplier','customer','other'] as const).map(item=>
            <Pressable key={item} style={[styles.option,kind===item&&styles.activeOption]}
              onPress={()=>setKind(item)}><Text style={[styles.optionText,kind===item&&styles.activeOptionText]}>{KIND[item]}</Text></Pressable>
          )}
        </View>
        <TextInput style={styles.input} placeholder="Telefon (isteğe bağlı)" placeholderTextColor={palette.muted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={45}/>
        <TextInput style={styles.input} placeholder="Adres (isteğe bağlı)" placeholderTextColor={palette.muted} value={address} onChangeText={setAddress} maxLength={1000}/>
        <TextInput style={[styles.input,styles.multi]} multiline placeholder="Firma notu (isteğe bağlı)" placeholderTextColor={palette.muted} value={description} onChangeText={setDescription} maxLength={1000}/>
        <Pressable style={[styles.addButton,busy&&styles.disabled]} disabled={busy} onPress={()=>void create()}>
          {busy?<ActivityIndicator color="#111827"/>:<><Ionicons name="checkmark" color="#111827" size={20}/><Text style={styles.addButtonText}>Defteri Kaydet</Text></>}
        </Pressable>
      </View> : null}
      {wallets.length?<View style={{gap:8}}>
        <Text style={styles.formHeading}>Kasa ve Banka Defterleri</Text>
        {wallets.map(wallet=><Pressable key={wallet.id} style={styles.contact} onPress={()=>router.push({pathname:'/ledger/wallet/[id]',params:{id:wallet.id}} as never)}>
          <View style={styles.contactIcon}><Ionicons name={wallet.kind==='cash'?'cash-outline':'card-outline'} size={23} color={palette.text}/></View>
          <View style={{flex:1,gap:4}}>
            <Text style={styles.contactName}>{wallet.name}</Text>
            <Text style={styles.contactMeta}>{wallet.kind==='cash'?'Kasa':'Banka'} · {wallet.movement_count} hareket</Text>
            <Text style={styles.contactBalance}>Bakiye {formatCents(wallet.balance_cents)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.muted}/>
        </Pressable>)}
      </View>:null}
      <TextInput style={styles.input} placeholder="Firma defterlerinde ara..." placeholderTextColor={palette.muted}
        value={query} onChangeText={setQuery}/>
      {error ? <Pressable style={styles.error} onPress={()=>void load(true)}>
        <Text style={styles.errorText}>{error} · Tekrar dene</Text>
      </Pressable> : null}
      {loading ? <ActivityIndicator color={palette.accent}/> : filtered.length ? filtered.map(contact=>
        <Pressable key={contact.id} style={styles.contact} onPress={()=>router.push({pathname:'/ledger/[id]',params:{id:contact.id}} as never)}>
          <View style={styles.contactIcon}><Ionicons name={contact.kind==='customer'?'people-outline':'business-outline'} size={23} color={palette.text}/></View>
          <View style={{flex:1,gap:3}}>
            <Text style={styles.contactName} numberOfLines={2}>{contact.name}</Text>
            <Text style={styles.contactMeta}>{KIND[contact.kind]} · {contact.movement_count||0} hareket</Text>
            <Text style={styles.contactBalance}>Alacak {formatCents(contact.receivable_balance_cents)}</Text>
            <Text style={styles.contactBalance}>Borç {formatCents(contact.debt_balance_cents)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.muted}/>
        </Pressable>
      ) : !error?<View style={styles.empty}>
        <Ionicons name="book-outline" size={32} color={palette.muted}/>
        <Text style={styles.emptyTitle}>{query?'Eşleşen defter bulunamadı':'Henüz defter oluşturulmadı'}</Text>
        <Text style={styles.contactMeta}>{query?'Aramayı değiştirin':'İlk firmanı ekleyerek ticari hareketlerini kaydet.'}</Text>
      </View>:null}
      <Text style={styles.footnote}>Defterim kişisel ticari takip içindir; resmî e-Defter yerine geçmez.</Text>
    </ScrollView>
  </Screen>;
}
const buildStyles=(p:AppPalette)=>StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:54,paddingHorizontal:12},
  headerTitle:{fontSize:19,fontWeight:'900',color:p.text},back:{width:40,height:40,alignItems:'center',justifyContent:'center'},
  page:{padding:spacing.lg,paddingBottom:110,gap:spacing.md},
  subtitle:{fontSize:13,color:p.textSecondary,lineHeight:19},
  summary:{flexDirection:'row',gap:8},
  summaryCell:{flex:1,backgroundColor:p.surface,borderColor:p.border,borderWidth:1,borderRadius:radius.lg,padding:12,gap:7,minHeight:103},
  summaryLabel:{fontSize:12,color:p.textSecondary},
  summaryAmount:{fontSize:16,color:p.text,fontWeight:'900'},
  metrics:{flexDirection:'row',alignItems:'center',gap:6},
  metricText:{fontSize:12,fontWeight:'700',color:p.text},
  metricTip:{fontSize:10,color:p.muted,marginLeft:'auto'},
  addButton:{minHeight:48,backgroundColor:'#FACC15',borderRadius:radius.md,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,padding:10},
  addButtonText:{fontSize:14,fontWeight:'900',color:'#111827'},
  form:{borderWidth:1,borderColor:p.border,backgroundColor:p.surface,padding:spacing.md,borderRadius:radius.lg,gap:spacing.sm},
  formHeading:{fontWeight:'800',color:p.text,marginBottom:3},
  input:{minHeight:46,borderRadius:radius.md,borderWidth:1,borderColor:p.border,paddingHorizontal:12,paddingVertical:10,color:p.text,backgroundColor:p.surface,fontSize:14},
  multi:{minHeight:68,textAlignVertical:'top'},
  options:{flexDirection:'row',gap:6},
  option:{flex:1,borderWidth:1,borderColor:p.border,paddingVertical:11,paddingHorizontal:5,borderRadius:radius.sm,alignItems:'center'},
  activeOption:{backgroundColor:p.surfaceSecondary,borderColor:'#C79A00'},
  optionText:{fontSize:11,fontWeight:'700',color:p.textSecondary},
  activeOptionText:{color:p.text},
  disabled:{opacity:.45},
  error:{padding:12,backgroundColor:p.surfaceSecondary,borderRadius:radius.md},
  errorText:{color:'#EF4444'},
  contact:{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderWidth:1,borderColor:p.border,borderRadius:radius.lg,backgroundColor:p.surface},
  contactIcon:{width:42,height:42,alignItems:'center',justifyContent:'center',borderRadius:radius.md,backgroundColor:p.surfaceSecondary},
  contactName:{fontWeight:'900',fontSize:15,color:p.text},
  contactMeta:{fontSize:12,color:p.textSecondary},
  contactBalance:{fontSize:12,color:p.text,fontWeight:'700'},
  empty:{paddingVertical:45,alignItems:'center',gap:9},
  emptyTitle:{fontSize:15,fontWeight:'800',color:p.text},
  footnote:{fontSize:11,color:p.muted,lineHeight:16,textAlign:'center',marginTop:12},
});