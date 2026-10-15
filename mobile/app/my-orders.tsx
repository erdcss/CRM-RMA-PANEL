import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAppearance } from '@/contexts/AppearanceContext';
import { rmaApi, type B2BOrderSummary } from '@/lib/api';

function status(value?: string | null) {
  const labels: Record<string, string> = {
    paid: 'Ödeme alındı', paid_stock_review: 'Stok kontrolünde',
    awaiting_bank_transfer: 'Havale bekleniyor', completed: 'Tamamlandı',
    cancelled: 'İptal edildi', cancel_requested: 'İptal talebi',
  };
  return labels[String(value || '').toLowerCase()] || value || 'İşlemde';
}
export default function MyOrdersScreen() {
  const router = useRouter();
  const { palette } = useAppearance();
  const [orders, setOrders] = useState<B2BOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const result = await rmaApi.listB2BOrders();
    setOrders(Array.isArray(result) ? result : []);
  }, []);
  useEffect(() => { let mounted = true; void load().catch(() => undefined).finally(() => { if (mounted) setLoading(false); }); return () => { mounted = false; }; }, [load]);
  const refresh = async () => { setRefreshing(true); try { await load(); } catch {} finally { setRefreshing(false); } };
  return <Screen style={{ backgroundColor: palette.background }}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Geri dön" style={styles.back}>
        <Ionicons name="chevron-back" size={24} color={palette.text} />
      </Pressable>
      <Text style={[styles.title, { color: palette.text }]}>Siparişlerim</Text>
      <View style={styles.back} />
    </View>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={palette.text} />} contentContainerStyle={styles.content}>
      {loading ? <ActivityIndicator color={palette.accent} /> : orders.length ? orders.map((order) => (
        <Pressable key={String(order.id)} accessibilityRole="button" accessibilityLabel={`Sipariş detayını aç: ${order.order_number || order.id}`} onPress={() => router.push({ pathname: '/my-orders/[id]', params: { id: String(order.id) } } as never)} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={{ flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12 }}>
            <Text style={{ color: palette.text,fontSize:15,fontWeight:'800',flex:1 }} numberOfLines={1}>{order.order_number || 'Sipariş #'+order.id}</Text>
            <Text style={{ color: palette.accentText,backgroundColor:palette.accent,paddingHorizontal:9,paddingVertical:5,borderRadius:11,fontSize:11,fontWeight:'800' }}>{status(order.status)}</Text>
          </View>
          <Text style={{ color: palette.textSecondary, marginTop:10,fontSize:12 }}>
            {order.created_at ? new Date(order.created_at).toLocaleDateString('tr-TR') : 'Sipariş'} · {order.item_count || 0} ürün
          </Text>
          <Text style={{ color: palette.text,fontSize:18,fontWeight:'900',marginTop:8 }}>{Number(order.total_amount || 0).toLocaleString('tr-TR',{style:'currency',currency:'TRY'})}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }}>
            <Text style={{ color: palette.textSecondary, fontSize: 12 }}>{order.shipping_method === 'cargo' ? 'PTT Kargo' : order.shipping_method === 'freight' ? 'Ambar / Nakliye' : order.shipping_method === 'pickup' ? 'Mağazadan Teslim' : 'Teslimat türü belirtilmemiş'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>Detaylar</Text><Ionicons name="chevron-forward" size={16} color={palette.text}/></View>
          </View>
        </Pressable>
      )) : <View style={styles.empty}>
        <Ionicons name="bag-handle-outline" size={40} color={palette.muted} />
        <Text style={{ color:palette.text,fontSize:17,fontWeight:'800',marginTop:13 }}>Henüz siparişiniz yok</Text>
        <Text style={{ color:palette.textSecondary,marginTop:5 }}>Verdiğiniz siparişler burada listelenir.</Text>
      </View>}
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({
  header:{ flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12,minHeight:54 },
  back:{ width:42,height:42,alignItems:'center',justifyContent:'center' },
  title:{ fontSize:19,fontWeight:'900' },
  content:{ paddingHorizontal:16,paddingVertical:18,paddingBottom:110,gap:12 },
  card:{ borderWidth:1,borderRadius:16,padding:16 },
  empty:{ alignItems:'center',justifyContent:'center',paddingVertical:90 },
});
