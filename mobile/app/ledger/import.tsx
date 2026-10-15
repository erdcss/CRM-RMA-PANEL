import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { rmaApi, type B2BLedgerPdfPreview } from '@/lib/api';
import { appAlert } from '@/lib/appAlert';
import { radius, spacing } from '@/constants/theme';

function money(cents:string) {
  const number=Number(cents);
  return Number.isFinite(number)?(number/100).toLocaleString('tr-TR',{style:'currency',currency:'TRY'}):'—';
}
const groups = [{key:'cari',name:'Cari hesaplar'},{key:'cash',name:'Kasa'},{key:'bank',name:'Banka / çek-senet portföyü'}] as const;

export default function LedgerPdfImport() {
  const router=useRouter();
  const {palette}=useAppearance();
  const styles=useMemo(()=>makeStyles(palette),[palette]);
  const [preview,setPreview]=useState<B2BLedgerPdfPreview|null>(null);
  const [positiveMeans,setPositiveMeans]=useState<'receivable'|'debt'|null>(null);
  const [skip,setSkip]=useState<number[]>([]);
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<string|null>(null);
  async function pick() {
    if(busy)return;
    setBusy(true);setResult(null);setPreview(null);setSkip([]);setPositiveMeans(null);
    try {
      const picked=await DocumentPicker.getDocumentAsync({type:'application/pdf',copyToCacheDirectory:true,multiple:false});
      if(picked.canceled || !picked.assets?.length)return;
      const file=picked.assets[0];
      if(file.size && file.size>5_000_000)throw new Error('PDF dosyası 5 MB sınırını aşıyor.');
      const base64=await FileSystem.readAsStringAsync(file.uri,{encoding:FileSystem.EncodingType.Base64});
      const parsed=await rmaApi.previewB2BLedgerPdf(file.name,base64);
      setPreview(parsed);
      setSkip(parsed.rows.filter(row=>row.exists).map(row=>row.index));
    } catch(err) {
      appAlert('PDF okunamadı',err instanceof Error?err.message:'Dosya yüklenemedi',undefined,'error');
    } finally {setBusy(false);}
  }
  async function confirm() {
    if(!preview||!positiveMeans||busy)return;
    setBusy(true);
    try {
      const response=await rmaApi.confirmB2BLedgerPdf(preview.previewId,positiveMeans,skip);
      setResult(response.createdContacts+' cari defter ve '+response.createdWallets+' kasa/banka hesabı aktarıldı. '+
        (response.skippedExisting+response.skippedByUser)+' satır atlandı.');
      setPreview(null);
    } catch(err) {
      appAlert('İçe aktarım yapılamadı',err instanceof Error?err.message:'Tekrar deneyin',undefined,'error');
    } finally {setBusy(false);}
  }
  const summary=preview?.rows.filter(row=>!skip.includes(row.index)&&!row.exists)||[];
  return <Screen style={{backgroundColor:palette.background}}>
    <View style={styles.top}>
      <Pressable onPress={()=>router.back()} style={styles.back} accessibilityLabel="Defterime dön"><Ionicons name="chevron-back" size={22} color={palette.text}/></Pressable>
      <Text style={styles.title}>PDF ile İçe Aktar</Text>
      <View style={styles.back}/>
    </View>
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <View style={styles.headingRow}><Ionicons name="document-text-outline" size={25} color={palette.text}/><Text style={styles.heading}>Eski defterinden geçiş yap</Text></View>
        <Text style={styles.help}>Eski uygulamandan aldığın DEFTER PDF raporunu yükle. Hesaplar önce kontrol ekranına gelir; sen onaylayana kadar kayıt oluşturulmaz.</Text>
        <Text style={styles.help}>Bu aktarım geçmiş ödeme/satış hareketlerini değil, rapor tarihindeki açılış bakiyelerini oluşturur. Görsel tarama PDF'leri ve bilinmeyen şablonlar bu sürümde desteklenmez.</Text>
        <Pressable onPress={()=>void pick()} disabled={busy} style={[styles.primary,busy&&styles.disabled]}>
          {busy?<ActivityIndicator color="#111827"/>:<><Ionicons name="cloud-upload-outline" size={19} color="#111827"/><Text style={styles.primaryText}>PDF Dosyası Seç</Text></>}
        </Pressable>
      </View>
      {result?<View style={styles.card}>
        <Ionicons name="checkmark-circle-outline" color="#16A34A" size={28}/>
        <Text style={styles.heading}>Aktarım tamamlandı</Text>
        <Text style={styles.help}>{result}</Text>
        <Pressable style={styles.primary} onPress={()=>router.replace('/ledger' as never)}><Text style={styles.primaryText}>Defterime Git</Text></Pressable>
      </View>:null}
      {preview?<View style={styles.card}>
        <Text style={styles.heading}>{preview.sourceLabel}</Text>
        <Text style={styles.help}>{preview.reportDate||'Tarih belirtilmemiş'} · {preview.rows.length} hesap · Toplamlar doğrulandı</Text>
        {groups.map(group=><View key={group.key} style={styles.group}>
          <View style={styles.groupTitle}>
            <Text style={styles.bold}>{group.name}</Text>
            <Text style={styles.money}>{money(preview.totals[group.key].totalCents)}</Text>
          </View>
          <Text style={styles.help}>{preview.totals[group.key].count} kayıt</Text>
          {preview.rows.filter(row=>row.section===group.key).map(row=>{
            const disabled=row.exists;
            const excluded=skip.includes(row.index)||disabled;
            return <Pressable key={row.index} style={styles.line} onPress={()=>{if(disabled)return;setSkip(rows=>rows.includes(row.index)?rows.filter(i=>i!==row.index):[...rows,row.index]);}}>
              <Ionicons name={excluded?'square-outline':'checkbox'} size={21} color={disabled?palette.muted:palette.text}/>
              <View style={{flex:1,gap:3}}>
                <Text style={[styles.lineName,excluded&&styles.muted]}>{row.name}</Text>
                {disabled?<Text style={styles.warning}>Bu firma mevcut · tekrar eklenmeyecek</Text>:null}
              </View>
              <Text style={[styles.lineAmount,excluded&&styles.muted]}>{money(row.signedCents)}</Text>
            </Pressable>;
          })}
        </View>)}
        <Text style={styles.heading}>Borç / alacak işaretlerini onayla</Text>
        <Text style={styles.help}>Eski programında pozitif (+) cari bakiye ne anlama geliyor? Yanlış seçim bakiyeleri ters gösterir.</Text>
        <View style={styles.options}>
          <Pressable style={[styles.option,positiveMeans==='receivable'&&styles.optionSelected]} onPress={()=>setPositiveMeans('receivable')}>
            <Ionicons name={positiveMeans==='receivable'?'radio-button-on':'radio-button-off'} size={19} color={palette.text}/>
            <Text style={styles.optionText}>Pozitif bakiye = Alacak</Text>
          </Pressable>
          <Pressable style={[styles.option,positiveMeans==='debt'&&styles.optionSelected]} onPress={()=>setPositiveMeans('debt')}>
            <Ionicons name={positiveMeans==='debt'?'radio-button-on':'radio-button-off'} size={19} color={palette.text}/>
            <Text style={styles.optionText}>Pozitif bakiye = Borç</Text>
          </Pressable>
        </View>
        <View style={styles.notice}><Text style={styles.noticeText}>Toplam {summary.length} hesap içe alınacak. Mevcut firma ve seçimini kaldırdığın satırlar atlanır. Aynı PDF iki kez aktarılamaz.</Text></View>
        <Pressable style={[styles.primary,(!positiveMeans||busy||!summary.length)&&styles.disabled]} disabled={!positiveMeans||busy||!summary.length} onPress={()=>void confirm()}>
          {busy?<ActivityIndicator color="#111827"/>:<><Ionicons name="checkmark-circle-outline" color="#111827" size={20}/><Text style={styles.primaryText}>Onayla ve İçe Aktar</Text></>}
        </Pressable>
      </View>:null}
    </ScrollView>
  </Screen>;
}
const makeStyles=(p:AppPalette)=>StyleSheet.create({
  top:{height:56,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12},
  back:{width:42,height:42,alignItems:'center',justifyContent:'center'},
  title:{fontSize:18,fontWeight:'900',color:p.text},
  page:{padding:spacing.md,paddingBottom:100,gap:spacing.md},
  card:{backgroundColor:p.surface,borderColor:p.border,borderWidth:1,borderRadius:radius.lg,padding:spacing.md,gap:12},
  headingRow:{flexDirection:'row',alignItems:'center',gap:9},
  heading:{fontSize:16,fontWeight:'900',color:p.text},
  help:{fontSize:12,lineHeight:19,color:p.textSecondary},
  primary:{flexDirection:'row',alignItems:'center',justifyContent:'center',minHeight:46,borderRadius:radius.md,backgroundColor:'#FACC15',gap:7,padding:12},
  primaryText:{color:'#111827',fontWeight:'900',fontSize:14},
  disabled:{opacity:.45},
  group:{gap:4,paddingVertical:10,borderTopWidth:1,borderTopColor:p.border},
  groupTitle:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  bold:{color:p.text,fontWeight:'900',fontSize:14},
  money:{color:p.text,fontWeight:'900',fontSize:13},
  line:{flexDirection:'row',alignItems:'center',gap:8,minHeight:44,paddingVertical:7},
  lineName:{color:p.text,fontWeight:'600',fontSize:12},
  lineAmount:{color:p.text,fontWeight:'800',fontSize:12},
  muted:{color:p.muted,opacity:.65},
  warning:{color:'#D97706',fontSize:10},
  options:{gap:7},
  option:{borderWidth:1,borderColor:p.border,padding:12,flexDirection:'row',alignItems:'center',gap:10,borderRadius:radius.md},
  optionSelected:{borderColor:'#EAB308',backgroundColor:p.surfaceSecondary},
  optionText:{fontSize:13,fontWeight:'700',color:p.text},
  notice:{padding:12,backgroundColor:p.surfaceSecondary,borderRadius:radius.md},
  noticeText:{fontSize:12,lineHeight:18,color:p.text},
});