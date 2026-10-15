import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { rmaApi, absoluteMediaUrl, type B2BOrderDetail, type B2BOrderAddress } from '@/lib/api';
import { spacing, radius, typography } from '@/constants/theme';

function readable(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
function currency(value: unknown): string {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }) : '—';
}
function statusLabel(value: unknown) {
  const labels: Record<string,string> = {
    paid: 'Ödeme alındı', paid_stock_review: 'Stok kontrolünde',
    awaiting_bank_transfer: 'Havale bekleniyor', awaiting_bank_confirmation: 'Havale kontrol ediliyor',
    payment_pending: 'Ödeme bekliyor', completed: 'Tamamlandı',
    cancelled: 'İptal edildi', cancel_requested: 'İptal talebi',
  };
  return labels[readable(value)] || readable(value) || 'İşlemde';
}
function deliveryLabel(value?: string | null) {
  switch (value) {
    case 'cargo': return 'PTT Kargo / Kargo';
    case 'freight': return 'Ambar / Nakliye';
    case 'pickup': return 'Mağazadan Teslim';
    default: return 'Teslimat türü belirtilmemiş';
  }
}
function addressText(address?: B2BOrderAddress | null) {
  if (!address) return 'Adres bilgisi bulunmuyor';
  return [address.addressLine, address.district, address.city, address.postalCode].filter(Boolean).join(', ') || 'Adres bilgisi bulunmuyor';
}
function DetailRow({ label, value, palette }: { label: string; value: string; palette: AppPalette }) {
  return (
    <View style={{ paddingVertical: 8, gap: 3 }}>
      <Text style={{ color: palette.textSecondary, fontSize: 12 }}>{label}</Text>
      <Text selectable style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>{value || 'Belirtilmemiş'}</Text>
    </View>
  );
}
export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { palette } = useAppearance();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [order, setOrder] = useState<B2BOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!id) { setError('Sipariş numarası bulunamadı.'); setLoading(false); return; }
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await rmaApi.getB2BOrderDetail(id);
      setOrder(result);
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Sipariş bilgileri alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const method = order?.shipping_method;
  const details = order?.shipping_details;
  const shipping = order?.shipping_address;
  const billing = order?.billing_details;
  const products = Array.isArray(order?.items) ? order.items : [];
  const shippingRows: Array<[string,string]> = [];
  if (method === 'cargo') {
    shippingRows.push(['Taşıyıcı', readable(details?.carrier) || readable(shipping?.carrier) || 'PTT Kargo']);
  } else if (method === 'freight') {
    shippingRows.push(['Ambar firması', readable(details?.companyName) || readable(shipping?.freightCompany) || 'Belirtilmemiş']);
    shippingRows.push(['Ambar telefonu', readable(details?.phone) || readable(shipping?.freightPhone) || 'Belirtilmemiş']);
  } else if (method === 'pickup') {
    shippingRows.push(['Teslim alma saati', readable(details?.pickupTime) || readable(shipping?.pickupTime) || 'Belirtilmemiş']);
    shippingRows.push(['Teslim alma noktası', readable(details?.address) || readable(shipping?.addressLine) || 'Belirtilmemiş']);
  }

  return <Screen style={{ backgroundColor: palette.background }}>
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Siparişlere dön">
        <Ionicons name="chevron-back" size={22} color={palette.text}/>
      </Pressable>
      <Text style={styles.topTitle}>Sipariş Detayı</Text>
      <View style={styles.backButton}/>
    </View>
    <ScrollView contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={palette.text}/>}>
      {loading ? <ActivityIndicator color={palette.accent} style={{ marginTop: 35 }}/> : error || !order ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>Sipariş detayına ulaşılamadı</Text>
          <Text style={styles.bodyText}>{error || 'Sipariş bulunamadı'}</Text>
          <Pressable onPress={() => void load()} style={styles.action}>
            <Text style={styles.actionText}>Tekrar dene</Text>
          </Pressable>
        </View>
      ) : <>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>SİPARİŞ NUMARASI</Text>
          <Text selectable style={styles.orderNumber}>{order.order_number || '#' + order.id}</Text>
          <Text style={styles.muted}>{order.created_at ? new Date(order.created_at).toLocaleString('tr-TR') : 'Tarih belirtilmemiş'}</Text>
          <View style={styles.statusBadge}><Text style={styles.statusText}>{statusLabel(order.status)}</Text></View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}><Ionicons name={method === 'pickup' ? 'storefront-outline' : method === 'freight' ? 'car-outline' : 'cube-outline'} size={20} color={palette.text}/><Text style={styles.sectionTitle}>Teslimat Bilgileri</Text></View>
          <DetailRow palette={palette} label="Seçilen teslimat türü" value={deliveryLabel(method)}/>
          {shippingRows.map(([label,value]) => <DetailRow key={label} palette={palette} label={label} value={value}/>)}
          <DetailRow palette={palette} label={method === 'pickup' ? 'Teslim alma adresi' : 'Teslimat adresi'} value={addressText(shipping)}/>
          {shipping?.recipient && <DetailRow palette={palette} label="Alıcı" value={shipping.recipient}/>}
          {shipping?.phone && <DetailRow palette={palette} label="İletişim telefonu" value={shipping.phone}/>}
          {!method && <Text style={styles.muted}>Bu eski siparişte teslimat türü kaydedilmemiş.</Text>}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}><Ionicons name="receipt-outline" size={20} color={palette.text}/><Text style={styles.sectionTitle}>Sipariş Ürünleri</Text></View>
          {!products.length ? <Text style={styles.muted}>Ürün dökümü bulunamadı.</Text> : products.map((item,index) => {
            const imageUrl = absoluteMediaUrl(item.image);
            return <View key={String(item.productId || index)+'-'+index} style={styles.itemRow}>
              <View style={styles.productImage}>
                {imageUrl ? <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="contain"/> :
                  <Ionicons name="cube-outline" size={25} color={palette.muted}/>}
              </View>
              <View style={styles.itemText}>
                <Text style={styles.productName}>{item.name || 'Ürün'}</Text>
                <Text style={styles.muted}>Stok kodu: {item.sku || '—'}</Text>
                <Text style={styles.muted}>{Number(item.quantity || 0)} koli · Koli içi {Number(item.unitsPerBox || 0)} adet</Text>
                <Text style={styles.muted}>Toplam {Number(item.totalUnits || 0)} adet</Text>
                <Text style={styles.itemPrice}>{currency(item.total)}</Text>
              </View>
            </View>;
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}><Ionicons name="card-outline" size={20} color={palette.text}/><Text style={styles.sectionTitle}>Ödeme Özeti</Text></View>
          <DetailRow palette={palette} label="Ödeme yöntemi"
            value={order.payment_method === 'bank_transfer' ? 'Havale / EFT' : order.payment_method === 'card' ? 'Kredi / Banka Kartı' : 'Belirtilmemiş'}/>
          {order.payment_method === 'card' && <DetailRow palette={palette} label="Kart" value={`${order.card_association || 'Kart'}${order.card_last4 ? ' · •••• ' + order.card_last4 : ''}`}/>}
          <DetailRow palette={palette} label="Ödeme durumu" value={readable(order.payment_status) || 'Belirtilmemiş'}/>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Sipariş Toplamı</Text><Text style={styles.totalValue}>{currency(order.total_amount)}</Text></View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}><Ionicons name="document-text-outline" size={20} color={palette.text}/><Text style={styles.sectionTitle}>Fatura Bilgileri</Text></View>
          <DetailRow palette={palette} label="Firma" value={readable(billing?.companyName) || 'Belirtilmemiş'}/>
          {billing?.taxNumber && <DetailRow palette={palette} label="Vergi numarası" value={billing.taxNumber}/>}
          {billing?.taxOffice && <DetailRow palette={palette} label="Vergi dairesi" value={billing.taxOffice}/>}
          <DetailRow palette={palette} label="Fatura adresi" value={addressText(billing)}/>
        </View>
      </>}
    </ScrollView>
  </Screen>;
}

const createStyles = (palette: AppPalette) => StyleSheet.create({
  topBar:{ flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12,minHeight:56 },
  backButton:{ width:42,height:42,alignItems:'center',justifyContent:'center' },
  topTitle:{ ...typography.subtitle,color:palette.text,fontWeight:'900' },
  content:{ padding:spacing.md,paddingBottom:spacing.xxxl,gap:spacing.md },
  card:{ backgroundColor:palette.surface,borderRadius:radius.lg,borderWidth:1,borderColor:palette.border,padding:spacing.md,gap:4 },
  eyebrow:{ fontSize:10,fontWeight:'700',color:palette.textSecondary,letterSpacing:1 },
  orderNumber:{ fontSize:21,fontWeight:'900',color:palette.text,marginTop:3 },
  muted:{ color:palette.textSecondary,fontSize:12,marginTop:4 },
  bodyText:{ color:palette.textSecondary,fontSize:13,marginTop:8 },
  statusBadge:{ alignSelf:'flex-start',backgroundColor:palette.surfaceSecondary,paddingHorizontal:10,paddingVertical:7,borderRadius:radius.md,marginTop:12 },
  statusText:{ color:palette.text,fontSize:12,fontWeight:'800' },
  sectionHeading:{ flexDirection:'row',alignItems:'center',gap:8,marginBottom:8 },
  sectionTitle:{ ...typography.bodyMedium,color:palette.text,fontWeight:'800' },
  itemRow:{ flexDirection:'row',gap:spacing.sm,paddingVertical:spacing.sm,borderTopWidth:1,borderTopColor:palette.border },
  productImage:{ width:72,height:72,borderRadius:radius.md,overflow:'hidden',backgroundColor:palette.surfaceSecondary,alignItems:'center',justifyContent:'center' },
  itemText:{ flex:1,gap:2 },productName:{ color:palette.text,fontSize:13,fontWeight:'800' },
  itemPrice:{ color:palette.text,fontWeight:'900',marginTop:6,fontSize:15 },
  totalRow:{ borderTopWidth:1,borderTopColor:palette.border,marginTop:8,paddingTop:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between' },
  totalLabel:{ color:palette.text,fontSize:14,fontWeight:'800' },
  totalValue:{ color:palette.text,fontSize:18,fontWeight:'900' },
  errorTitle:{ color:palette.text,fontSize:16,fontWeight:'800' },
  action:{ marginTop:12,alignSelf:'flex-start',backgroundColor:'#FACC15',paddingHorizontal:18,paddingVertical:12,borderRadius:radius.md },
  actionText:{ color:'#111827',fontWeight:'800' },
});