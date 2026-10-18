import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { rmaApi, type B2BLedgerWalletDetail } from '@/lib/api';
import { appAlert } from '@/lib/appAlert';
import { radius, spacing } from '@/constants/theme';
function cash(value:string|number|undefined) {return (Number(value||0)/100).toLocaleString('tr-TR',{style:'currency',currency:'TRY'});}
function dateToday() {const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function key() {const x=()=>Math.floor(Math.random()*65536).toString(16).padStart(4,'0');return x()+x()+'-'+x()+'-4'+x().slice(1)+'-a'+x().slice(1)+'-'+x()+x()+x();}
function amountInput(value:string) {const t=value.trim().replace(/\s/g,'');if(t.includes(','))return t.replace(/\./g,'').replace(',','.');return /^\d{1,3}(?:\.\d{3})+$/.test(t)?t.replace(/\./g,''):t;}
export default function LedgerWallet() {
  const router=useRouter(), {id}=useLocalSearchParams<{id?:string}>();
  const {palette}=useAppearance();
  const styles=useMemo(()=>makeStyles(palette),[palette]);
  const [wallet,setWallet]=useState<B2BLedgerWalletDetail|null>(null);
  const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [direction,setDirection]=useState<'in'|'out'>('in');
  const [amount,setAmount]=useState(''),[description,setDescription]=useState(''),[form,setForm]=useState(false);
  const [pendingKey,setPendingKey]=useState(key);
  const load=useCallback(async(refresh=false)=>{
    if(!id){setError('Hesap seçilmedi.');setLoading(false);return;}
    if(refresh)setRefreshing(true);else setLoading(true);
    try{setWallet(await rmaApi.getB2BLedgerWallet(id));setError('');}
    catch(err){setError(err instanceof Error?err.message:'Hesap okunamadı.');}
    finally{setLoading(false);setRefreshing(false);}
  },[id]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  async function save(){
    if(!id||busy)return;
    const value=amountInput(amount);
    if(!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(value)||Number(value)<=0){
      appAlert('Tutar geçersiz','Pozitif bir tutar girin.');return;
    }
    setBusy(true);
    try{
      await rmaApi.addB2BLedgerWalletMovement(id,{direction,amount:value,description:description.trim(),effectiveOn:dateToday(),requestKey:pendingKey});
      setAmount('');setDescription('');setPendingKey(key());setForm(false);await load(true);
    }catch(err){appAlert('Hareket kaydedilemedi',err instanceof Error?err.message:'Tekrar deneyin',undefined,'error');}
    finally{setBusy(false);}
  }
  return <Screen style={{backgroundColor:palette.background}}>
    <View style={styles.header}>
      <Pressable style={styles.back} onPress={()=>router.back()}><Ionicons name="chevron-back" size={23} color={palette.text}/></Pressable>
      <Text style={styles.title}>Kasa / Banka Defteri</Text><View style={styles.back}/>
    </View>
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)} tintColor={palette.text}/>}>
      {loading?<ActivityIndicator color={palette.accent}/>:error||!wallet?<Pressable style={styles.card} onPress={()=>void load()}><Text style={styles.text}>{error||'Hesap bulunamadı'} · Yeniden dene</Text></Pressable>:<>
        <View style={styles.card}>
          <Text style={styles.muted}>{wallet.kind==='cash'?'Nakit / Kasa':'Banka / Çek-Senet'}</Text>
          <Text style={styles.title}>{wallet.name}</Text>
          <Text style={styles.muted}>Açılış bakiyesi</Text>
          <Text style={styles.amount}>{cash(wallet.opening_cents)}</Text>
          <Text style={styles.muted}>Güncel bakiye</Text>
          <Text style={styles.amount}>{cash(wallet.balance_cents)}</Text>
        </View>
        <Pressable style={styles.primary} onPress={()=>setForm(v=>!v)}>
          <Ionicons name={form?'close':'add'} size={20} color="#111827"/>
          <Text style={styles.primaryText}>{form?'Formu kapat':'Kasa / Banka Hareketi Ekle'}</Text>
        </Pressable>
        {form?<View style={styles.card}>
          <Text style={styles.text}>Hareket türü</Text>
          <View style={styles.row}>
            {(['in','out'] as const).map(v=><Pressable key={v} onPress={()=>setDirection(v)} style={[styles.choice,direction===v&&styles.chosen]}>
              <Text style={styles.text}>{v==='in'?'Para girişi':'Para çıkışı'}</Text>
            </Pressable>)}
          </View>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Tutar (₺)" placeholderTextColor={palette.muted}/>
          <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Açıklama" placeholderTextColor={palette.muted} maxLength={500}/>
          <Pressable style={[styles.primary,busy&&styles.disabled]} disabled={busy} onPress={()=>void save()}>
            {busy?<ActivityIndicator color="#111827"/>:<Text style={styles.primaryText}>Hareketi Kaydet</Text>}
          </Pressable>
        </View>:null}
        <View style={styles.card}>
          <Text style={styles.title}>Hesap Hareketleri</Text>
          {!wallet.movements.length?<Text style={styles.muted}>Bu hesapta henüz yeni hareket yok.</Text>:wallet.movements.map(row=>
            <View key={row.id} style={styles.movement}>
              <View style={{flex:1,gap:4}}>
                <Text style={styles.text}>{row.description|| (row.direction==='in'?'Para girişi':'Para çıkışı')}</Text>
                <Text style={styles.muted}>{String(row.effective_on).slice(0,10)}</Text>
              </View>
              <Text style={styles.amountSmall}>{row.direction==='out'?'−':'+'}{cash(row.amount_cents)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.muted}>Bu kayıtlar işletme içi takip içindir; resmî banka hareketi veya e-Defter değildir.</Text>
      </>}
    </ScrollView>
  </Screen>;
}
const makeStyles=(p:AppPalette)=>StyleSheet.create({
  header:{height:55,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12},
  back:{width:42,height:42,justifyContent:'center',alignItems:'center'},
  title:{fontSize:17,fontWeight:'400',color:p.text},
  page:{padding:spacing.md,paddingBottom:100,gap:spacing.md},
  card:{borderWidth:1,borderColor:p.border,backgroundColor:p.surface,borderRadius:radius.lg,padding:spacing.md,gap:10},
  text:{fontSize:13,color:p.text,fontWeight:'400'},
  muted:{fontSize:12,color:p.textSecondary,lineHeight:18},
  amount:{fontSize:21,color:p.text,fontWeight:'400'},
  amountSmall:{fontSize:13,fontWeight:'400',color:p.text},
  primary:{borderRadius:radius.md,backgroundColor:'#FACC15',minHeight:45,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  primaryText:{fontSize:13,fontWeight:'400',color:'#111827'},
  row:{flexDirection:'row',gap:8},
  choice:{padding:11,borderWidth:1,borderColor:p.border,borderRadius:radius.sm,flex:1,alignItems:'center'},
  chosen:{borderColor:'#D4A000',backgroundColor:p.surfaceSecondary},
  input:{borderRadius:radius.md,backgroundColor:p.background,borderWidth:1,borderColor:p.border,paddingHorizontal:12,paddingVertical:10,minHeight:44,color:p.text},
  disabled:{opacity:.5},
  movement:{flexDirection:'row',alignItems:'center',gap:10,borderTopWidth:1,borderTopColor:p.border,paddingVertical:10},
});