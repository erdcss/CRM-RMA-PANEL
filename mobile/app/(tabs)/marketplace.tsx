import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppearance } from '@/contexts/AppearanceContext';
import { absoluteMediaUrl, rmaApi, type MarketplaceProduct } from '@/lib/api';

const yellow = '#FFCD00';

function money(value: number | string | null | undefined) {
  if (value == null) return 'Fiyat için giriş yapın';
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺' : 'Fiyat için giriş yapın';
}

export default function MarketplaceProductsScreen() {
  const { palette } = useAppearance();
  const router = useRouter();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await rmaApi.listMarketplaceProducts();
      setProducts(Array.isArray(result) ? result : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tedarikçi ürünleri alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const filtered = useMemo(() => products.filter(product => (
    [product.content?.name, product.seller_name, product.sku, product.content?.category]
      .some(value => String(value || '').toLocaleLowerCase('tr-TR').includes(query.trim().toLocaleLowerCase('tr-TR')))
  )), [products, query]);

  return <View style={[styles.page, { backgroundColor: palette.background }]}>
    <View style={[styles.header, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Geri dön" style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={palette.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: palette.text }]}>Tedarikçi Pazaryeri</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>Yalnızca onaylı firmaların yayındaki ürünleri</Text>
        </View>
      </View>
      <View style={[styles.search, { borderColor: palette.border, backgroundColor: palette.background }]}>
        <Ionicons name="search" size={19} color={palette.textSecondary} />
        <TextInput placeholder="Ürün, marka veya satıcı ara" placeholderTextColor={palette.textSecondary} value={query}
          onChangeText={setQuery} style={[styles.searchInput, { color: palette.text }]} />
      </View>
    </View>
    <FlatList
      data={filtered}
      keyExtractor={item => String(item.id)}
      numColumns={2}
      columnWrapperStyle={styles.columns}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={yellow}/>}
      ListHeaderComponent={<Text style={[styles.count, { color: palette.textSecondary }]}>
        {loading ? 'Ürünler yükleniyor…' : filtered.length + ' onaylı ürün'}
      </Text>}
      renderItem={({ item }) => <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.content.name + ', ' + item.seller_name}
        style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        onPress={() => router.push({ pathname: '/product/[id]',
          params: { slug: item.seller_slug, id: 'mp-' + String(item.id) } } as never)}
      >
        <View style={styles.photo}>
          {item.content.imageUrl
            ? <Image source={{ uri: absoluteMediaUrl(item.content.imageUrl) || undefined }}
                style={styles.photoImage} contentFit="contain" />
            : <Ionicons name="cube-outline" size={36} color="#94A3B8" />}
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: palette.text }]} numberOfLines={2}>{item.content.name}</Text>
          <View style={styles.sellerLine}>
            <Ionicons name="storefront-outline" size={14} color="#92400E"/>
            <Text style={[styles.sellerName, { color: palette.textSecondary }]} numberOfLines={1}>{item.seller_name}</Text>
            <Ionicons name="checkmark-circle" size={13} color="#16A34A"/>
          </View>
          <Text style={[styles.price, { color: palette.text }]} numberOfLines={2}>{money(item.content.price)}</Text>
          <Text style={[styles.meta, { color: palette.textSecondary }]} numberOfLines={1}>
            {Math.max(1, Number(item.content.unitsPerBox) || 1)} adet / koli
          </Text>
        </View>
      </Pressable>}
      ListEmptyComponent={!loading
        ? <View style={styles.empty}>
            <Ionicons name={error ? 'cloud-offline-outline' : 'storefront-outline'} size={42} color={palette.textSecondary}/>
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              {error || (query ? 'Aramanızla eşleşen ürün bulunamadı.' : 'Henüz onaylı tedarikçi ürünü yayınlanmadı.')}
            </Text>
            {error ? <Pressable onPress={() => void load(true)} style={styles.retry}>
              <Text style={styles.retryText}>Yeniden dene</Text>
            </Pressable> : null}
          </View>
        : null}
    />
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 13 },
  backButton: { height: 38, width: 32, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '900' },
  subtitle: { fontSize: 11, marginTop: 4 },
  search: { flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  list: { padding: 12, paddingBottom: 24, flexGrow: 1 },
  columns: { gap: 12, marginBottom: 12 },
  count: { fontSize: 12, fontWeight: '700', marginBottom: 12, marginHorizontal: 3 },
  card: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  photo: { height: 148, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', padding: 8 },
  photoImage: { width: '100%', height: '100%' },
  info: { gap: 7, padding: 10 },
  name: { fontSize: 13, lineHeight: 18, fontWeight: '800', minHeight: 36 },
  sellerLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sellerName: { flex: 1, fontSize: 11, fontWeight: '700' },
  price: { fontSize: 15, fontWeight: '900' },
  meta: { fontSize: 10 },
  empty: { alignItems: 'center', padding: 24, marginTop: 65, gap: 16 },
  emptyText: { textAlign: 'center', fontSize: 13, lineHeight: 19 },
  retry: { padding: 13, borderRadius: 12, backgroundColor: yellow },
  retryText: { fontWeight: '800', color: '#111827' },
});
