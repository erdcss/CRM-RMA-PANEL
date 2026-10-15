import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { radius, spacing, typography } from '@/constants/theme';
import { rmaApi, absoluteMediaUrl, homepageMediaUrl, type B2BProduct, type HomeCategoryCard } from '@/lib/api';
import { productMatchesCollection } from '@/lib/category-collections';

function money(price: string | number | null | undefined) {
  const value = Number(price);
  return Number.isFinite(value) ? value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺' : '—';
}

function imageFor(product: B2BProduct) {
  const raw = product.image_data || product.image_url ||
    (Array.isArray(product.images) ? product.images.find(img => typeof img === 'string' && img.trim()) : null);
  return absoluteMediaUrl(raw);
}

export default function CollectionScreen() {
  const { category: routeCategory } = useLocalSearchParams<{ category?: string }>();
  const category = String(routeCategory || '');
  const router = useRouter();
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  const { session } = useAuth();
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [categoryCard, setCategoryCard] = useState<HomeCategoryCard | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [catalog, homepage] = await Promise.all([
        rmaApi.listB2BProducts(refresh),
        rmaApi.getB2BHomepage(),
      ]);
      setProducts(Array.isArray(catalog) ? catalog : []);
      setCategoryCard((homepage.categoryCards || []).find(item =>
        item.category.toLocaleLowerCase('tr-TR') === category.toLocaleLowerCase('tr-TR')));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ürün kataloğu yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useEffect(() => { void load(true); }, [load, session?.access_token]);

  const visible = useMemo(
    () => products.filter(product => productMatchesCollection(product, category, categoryCard)),
    [products, category, categoryCard],
  );
  const label = categoryCard?.label || category;

  return (
    <Screen style={{ backgroundColor: palette.background }}>
      <FlatList
        data={visible}
        numColumns={2}
        keyExtractor={product => String(product.id)}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={palette.text} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
              <Ionicons name="chevron-back" size={19} color={palette.text} />
              <Text style={styles.backText}>Kategorilere dön</Text>
            </Pressable>
            {categoryCard?.imageId ? (
              <Image
                source={{ uri: homepageMediaUrl(categoryCard.imageId) || '' }}
                contentFit="contain"
                style={styles.banner}
              />
            ) : null}
            <Text style={styles.title}>{label}</Text>
            <Text style={styles.subtitle}>{visible.length} ürün · Koleksiyon</Text>
            {error ? (
              <Pressable style={styles.error} onPress={() => void load(true)}>
                <Text style={styles.errorText}>{error} · Tekrar dene</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const image = imageFor(item);
          const priceVisible = Boolean(session) && item.price !== null && item.price !== undefined;
          return (
            <Pressable style={styles.card}
              onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(item.id) } } as never)}>
              <View style={styles.imageBox}>
                {image ? <Image source={{ uri: image }} contentFit="contain" style={styles.image} cachePolicy="memory-disk" /> :
                  <Ionicons name="cube-outline" size={30} color={palette.muted} />}
              </View>
              <View style={styles.details}>
                <Text style={styles.sku} numberOfLines={1}>{item.sku || 'STOK'}</Text>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                {priceVisible ? (
                  <Text style={styles.price}>{money(item.price)}</Text>
                ) : (
                  <Text style={styles.locked}>Giriş yaparak fiyatı görün</Text>
                )}
                <Text style={styles.meta}>Koli içi {Number(item.units_per_box || 1)} adet</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={32} color={palette.muted} />
            <Text style={styles.emptyText}>{error ? 'Ürünler yüklenemedi.' : 'Bu koleksiyonda henüz ürün bulunmuyor.'}</Text>
            <Pressable onPress={() => void load(true)} style={styles.retry}><Text style={styles.retryText}>Yenile</Text></Pressable>
          </View>
        ) : <Text style={styles.loading}>Ürünler yükleniyor…</Text>}
      />
    </Screen>
  );
}

const buildStyles = (palette: AppPalette) => StyleSheet.create({
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl, flexGrow: 1 },
  columns: { justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm },
  header: { paddingVertical: spacing.lg, gap: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, minHeight: 42 },
  backText: { ...typography.bodyMedium, color: palette.text },
  banner: { width: '100%', height: 160, borderRadius: radius.lg },
  title: { ...typography.title, color: palette.text, fontWeight: '900' },
  subtitle: { ...typography.caption, color: palette.textSecondary },
  card: { width: '48.5%', borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: 'hidden' },
  imageBox: { width: '100%', aspectRatio: 1, backgroundColor: palette.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  details: { padding: spacing.sm, gap: 4 },
  sku: { fontSize: 10, color: palette.muted },
  name: { ...typography.bodyMedium, color: palette.text, fontWeight: '700', minHeight: 38 },
  price: { ...typography.subtitle, color: palette.text, fontWeight: '900' },
  locked: { ...typography.caption, color: palette.textSecondary },
  meta: { fontSize: 10, color: palette.muted },
  empty: { padding: spacing.xxl, alignItems: 'center', gap: spacing.md },
  emptyText: { ...typography.body, color: palette.textSecondary, textAlign: 'center' },
  loading: { padding: spacing.xl, color: palette.textSecondary, textAlign: 'center' },
  error: { padding: spacing.md, backgroundColor: palette.surfaceSecondary, borderRadius: radius.md },
  errorText: { ...typography.caption, color: palette.text },
  retry: { backgroundColor: '#FACC15', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
  retryText: { color: '#111827', fontWeight: '800' },
});
