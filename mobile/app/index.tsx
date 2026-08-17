import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { rmaApi, type RmaTicket } from '@/lib/api';

export default function HomeScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<RmaTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await rmaApi.listTickets();
      setTickets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıtlar alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>RMA kayıtları yükleniyor…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={tickets}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>RMA Takibi</Text>
          <Text style={styles.subtitle}>İade, değişim ve servis kayıtlarını iPhone üzerinden yönetin.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={<Text style={styles.muted}>Henüz kayıt bulunmuyor.</Text>}
      renderItem={({ item }) => {
        const openProducts = item.products.filter((product) => product.status !== 'teslim_edildi').length;
        return (
          <Pressable style={styles.card} onPress={() => router.push(`/ticket/${item.id}`)}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{item.receiptNumber || `RMA-${item.id}`}</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>{openProducts} açık</Text></View>
            </View>
            <Text style={styles.customer}>{item.customer.name || 'Bilinmeyen müşteri'}</Text>
            <Text style={styles.muted}>{item.customer.phone || '-'}</Text>
            <Text style={styles.meta}>{item.products.length} ürün • {new Date(item.createdAt).toLocaleDateString('tr-TR')}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f9fafb' },
  list: { padding: 16, gap: 12, backgroundColor: '#f9fafb', flexGrow: 1 },
  header: { gap: 6, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#6b7280' },
  error: { marginTop: 8, color: '#b91c1c' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  customer: { marginTop: 8, fontSize: 15, fontWeight: '600', color: '#1f2937' },
  muted: { color: '#6b7280' },
  meta: { marginTop: 8, fontSize: 12, color: '#9ca3af' },
  badge: { backgroundColor: '#dbeafe', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: '#1d4ed8', fontSize: 12, fontWeight: '600' },
});
