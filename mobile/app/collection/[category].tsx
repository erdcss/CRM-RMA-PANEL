import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { radius, spacing, typography } from '@/constants/theme';
import {
  rmaApi,
  absoluteMediaUrl,
  homepageMediaUrl,
  type B2BProduct,
  type HomeCategoryCard,
  type HomeSubcategory,
} from '@/lib/api';
import {
  normalizeCategoryText,
  productMatchesCollection,
  productMatchesSubcategory,
} from '@/lib/category-collections';
import { asCatalogProduct, productParams } from '@/lib/marketplace-products';

function money(price: string | number | null | undefined) {
  const value = Number(price);
  return Number.isFinite(value)
    ? value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
    : '—';
}

function imageFor(product: B2BProduct) {
  const raw = product.image_data || product.image_url ||
    (Array.isArray(product.images) ? product.images.find(img => typeof img === 'string' && img.trim()) : null);
  return absoluteMediaUrl(raw);
}

function matchesSearch(product: B2BProduct, term: string) {
  if (!term) return true;
  return [
    product.name, product.sku, product.category, product.collection_name,
    product.brand, product.seller_name,
  ].filter(Boolean).some(value => normalizeCategoryText(value).includes(term));
}

export default function CollectionScreen() {
  // Using a route parameter keeps the same navigable screen for parent and child
  // without creating a duplicate catalog, just like the web /kategori/.../alt/... route.
  const { category: routeCategory, subcategoryId: routeSubcategoryId } =
    useLocalSearchParams<{ category?: string; subcategoryId?: string }>();
  const category = String(routeCategory || '').trim();
  const subcategoryId = String(routeSubcategoryId || '');
  const router = useRouter();
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  const { session } = useAuth();

  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [categoryCard, setCategoryCard] = useState<HomeCategoryCard | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [catalogResult, supplierResult, homepageResult] = await Promise.allSettled([
        rmaApi.listB2BProducts(refresh),
        rmaApi.listMarketplaceProducts(),
        rmaApi.getB2BHomepage(),
      ]);
      const own = catalogResult.status === 'fulfilled' && Array.isArray(catalogResult.value)
        ? catalogResult.value : [];
      const suppliers = supplierResult.status === 'fulfilled' && Array.isArray(supplierResult.value)
        ? supplierResult.value.map(asCatalogProduct) : [];
      const homepage = homepageResult.status === 'fulfilled' ? homepageResult.value : { categoryCards: [] };
      setProducts([...suppliers, ...own]);
      setCategoryCard((homepage.categoryCards || []).find(item =>
        normalizeCategoryText(item.category) === normalizeCategoryText(category)));
      setError(catalogResult.status === 'rejected' && supplierResult.status === 'rejected'
        ? 'Ürün kataloğu yüklenemedi. Yeniden deneyin.' : '');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useEffect(() => { void load(); }, [load, session?.access_token]);
  useEffect(() => { setSearch(''); }, [category, subcategoryId]);

  const subcategory = useMemo(
    () => categoryCard?.subcategories?.find(item => item.id === subcategoryId),
    [categoryCard, subcategoryId],
  );
  const isSubcategory = Boolean(subcategoryId);
  const categoryLabel = categoryCard?.label || category;
  const title = subcategory?.name || (isSubcategory ? 'Alt kategori bulunamadı' : categoryLabel);
  const subcategories = categoryCard?.subcategories || [];
  const searchTerm = normalizeCategoryText(search);

  const visible = useMemo(
    () => products.filter(product =>
      (isSubcategory
        ? Boolean(subcategory && productMatchesSubcategory(product, subcategory))
        : productMatchesCollection(product, category, categoryCard)) &&
      matchesSearch(product, searchTerm)),
    [products, category, categoryCard, subcategory, isSubcategory, searchTerm],
  );
  const subcategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of subcategories) {
      counts.set(item.id, products.filter(product => productMatchesSubcategory(product, item)).length);
    }
    return counts;
  }, [products, subcategories]);

  const openCategory = () => {
    router.push({ pathname: '/collection/[category]', params: { category } } as never);
  };
  const openSubcategory = (item: HomeSubcategory) => {
    router.push({
      pathname: '/collection/[category]',
      params: { category, subcategoryId: item.id },
    } as never);
  };

  return (
    <Screen style={{ backgroundColor: palette.background }}>
      <FlatList
        key={category + ':' + subcategoryId}
        data={visible}
        numColumns={2}
        keyExtractor={product => String(product.id)}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={palette.text} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.breadcrumb}>
              <Pressable onPress={() => router.push('/(tabs)/menu')} accessibilityRole="button">
                <Text style={styles.breadcrumbLink}>Kategoriler</Text>
              </Pressable>
              <Ionicons name="chevron-forward" size={14} color={palette.muted} />
              {isSubcategory ? (
                <>
                  <Pressable onPress={openCategory} accessibilityRole="button">
                    <Text numberOfLines={1} style={styles.breadcrumbLink}>{categoryLabel}</Text>
                  </Pressable>
                  <Ionicons name="chevron-forward" size={14} color={palette.muted} />
                </>
              ) : null}
              <Text numberOfLines={1} style={styles.breadcrumbCurrent}>{title}</Text>
            </View>

            <View style={styles.hero}>
              {subcategory?.imageId || categoryCard?.imageId ? (
                <Image
                  source={{ uri: homepageMediaUrl(subcategory?.imageId || categoryCard?.imageId || '') || '' }}
                  contentFit="contain"
                  style={styles.heroImage}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={styles.heroFallback}>
                  <Ionicons name="grid-outline" size={36} color={palette.muted} />
                </View>
              )}
              <View style={styles.heroDetails}>
                <Text style={styles.eyebrow}>ÇALIŞKAN B2B · {isSubcategory ? 'ALT KATEGORİ' : 'KATEGORİ'}</Text>
                <Text style={styles.title} numberOfLines={3}>{title}</Text>
                <Text style={styles.subtitle}>
                  {loading ? 'Ürünler yükleniyor…' : String(visible.length) + ' ürün'}
                </Text>
              </View>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={21} color={palette.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={title + ' kategorisinde ürün ara'}
                placeholderTextColor={palette.muted}
                accessibilityLabel="Bu kategoride ürün ara"
                autoCorrect={false}
                returnKeyType="search"
                style={styles.searchInput}
              />
              {search.length > 0 ? (
                <Pressable onPress={() => setSearch('')} accessibilityLabel="Aramayı temizle" accessibilityRole="button">
                  <Ionicons name="close-circle" size={21} color={palette.muted} />
                </Pressable>
              ) : null}
            </View>

            {!isSubcategory && subcategories.length > 0 ? (
              <View style={styles.subcategorySection}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Alt Kategoriler</Text>
                  <Text style={styles.sectionCount}>{subcategories.length} alt kategori</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.subcategoryRail}
                  accessibilityLabel="Alt kategoriler, yana kaydırarak gezinin"
                >
                  {subcategories.map(item => {
                    const count = subcategoryCounts.get(item.id) || 0;
                    return (
                      <Pressable key={item.id} onPress={() => openSubcategory(item)}
                        accessibilityRole="button" accessibilityLabel={item.name + ', ' + count + ' ürün'}
                        style={styles.subcategoryCard}>
                        <View style={styles.subcategoryImageBox}>
                          {item.imageId ? (
                            <Image source={{ uri: homepageMediaUrl(item.imageId) || '' }}
                              contentFit="cover" style={styles.subcategoryImage} cachePolicy="memory-disk" />
                          ) : <Ionicons name="cube-outline" size={34} color={palette.muted} />}
                        </View>
                        <View style={styles.subcategoryBody}>
                          <Text style={styles.subcategoryName} numberOfLines={2}>{item.name}</Text>
                          <Text style={styles.subcategoryCount}>
                            {loading ? 'Yükleniyor…' : String(count) + ' ürün'}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>{isSubcategory ? 'Alt Kategori Ürünleri' : 'Kategori Ürünleri'}</Text>
              <Text style={styles.sectionCount}>{visible.length} ürün</Text>
            </View>
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
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/product/[id]', params: productParams(item) } as never)}>
              <View style={styles.imageBox}>
                {image ? <Image source={{ uri: image }} contentFit="contain" style={styles.image}
                  cachePolicy="memory-disk" /> :
                  <Ionicons name="cube-outline" size={30} color={palette.muted} />}
              </View>
              <View style={styles.details}>
                <Text style={styles.sku} numberOfLines={1}>{item.sku || 'STOK'}</Text>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                {priceVisible ? <Text style={styles.price}>{money(item.price)}</Text> :
                  <Text style={styles.locked}>Giriş yaparak fiyatı görün</Text>}
                {item.seller_name ? <Text style={styles.seller} numberOfLines={1}>{item.seller_name}</Text> : null}
                <Text style={styles.meta}>Koli içi {Number(item.units_per_box || 1)} adet</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? (
              <>
                <ActivityIndicator size="small" color={palette.text} />
                <Text style={styles.emptyText}>Ürünler yükleniyor…</Text>
              </>
            ) : (
              <>
                <Ionicons name="cube-outline" size={32} color={palette.muted} />
                <Text style={styles.emptyText}>
                  {error || (isSubcategory && !subcategory
                    ? 'Alt kategori bulunamadı.'
                    : searchTerm
                      ? 'Aramanızla eşleşen ürün bulunamadı.'
                      : 'Bu kategoride henüz ürün bulunmuyor.')}
                </Text>
                {searchTerm ? (
                  <Pressable onPress={() => setSearch('')} style={styles.retry} accessibilityRole="button">
                    <Text style={styles.retryText}>Aramayı Temizle</Text>
                  </Pressable>
                ) : null}
                {isSubcategory ? (
                  <Pressable onPress={openCategory} style={styles.retry} accessibilityRole="button">
                    <Text style={styles.retryText}>Ana Kategoriye Dön</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        }
        ListFooterComponent={isSubcategory ? (
          <Pressable onPress={openCategory} style={styles.footerBack} accessibilityRole="button">
            <Ionicons name="arrow-back" size={17} color={palette.text} />
            <Text style={styles.footerBackText}>{categoryLabel + ' kategorisine dön'}</Text>
          </Pressable>
        ) : null}
      />
    </Screen>
  );
}

const buildStyles = (palette: AppPalette) => StyleSheet.create({
  content: { paddingHorizontal: spacing.md, paddingBottom: 110, flexGrow: 1 },
  columns: { justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm },
  header: { paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, flexWrap: 'wrap' },
  breadcrumbLink: { color: palette.textSecondary, fontSize: 12, fontWeight: '600', maxWidth: 150 },
  breadcrumbCurrent: { color: palette.text, fontSize: 12, fontWeight: '800', maxWidth: 180 },
  hero: { minHeight: 136, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surface, borderRadius: radius.xl, flexDirection: 'row',
    alignItems: 'center', padding: spacing.md, gap: spacing.md },
  heroImage: { width: 108, height: 108, borderRadius: radius.lg, backgroundColor: palette.surfaceSecondary },
  heroFallback: { width: 108, height: 108, borderRadius: radius.lg, backgroundColor: palette.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center' },
  heroDetails: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 5 },
  eyebrow: { fontSize: 10, color: palette.textSecondary, letterSpacing: 0.7, fontWeight: '800' },
  title: { ...typography.title, color: palette.text, fontWeight: '900', fontSize: 21 },
  subtitle: { ...typography.caption, color: palette.textSecondary },
  searchBox: { minHeight: 50, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surface, borderRadius: radius.lg, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  searchInput: { flex: 1, minWidth: 0, color: palette.text, ...typography.body },
  subcategorySection: { marginTop: spacing.sm, gap: spacing.sm },
  sectionHeading: { minHeight: 34, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...typography.subtitle, color: palette.text, fontWeight: '900', flexShrink: 1 },
  sectionCount: { ...typography.caption, color: palette.textSecondary },
  subcategoryRail: { flexDirection: 'row', gap: 12, paddingVertical: 4, paddingRight: spacing.md },
  subcategoryCard: { width: 150, borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  subcategoryImageBox: { width: '100%', height: 145, alignItems: 'center',
    justifyContent: 'center', backgroundColor: palette.surfaceSecondary },
  subcategoryImage: { width: '100%', height: '100%' },
  subcategoryBody: { padding: spacing.sm, minHeight: 70 },
  subcategoryName: { ...typography.bodyMedium, color: palette.text, fontWeight: '800', lineHeight: 19 },
  subcategoryCount: { ...typography.caption, color: palette.textSecondary, marginTop: 5 },
  card: { width: '48.5%', borderRadius: radius.lg, borderWidth: 1,
    borderColor: palette.border, backgroundColor: palette.surface, overflow: 'hidden' },
  imageBox: { width: '100%', aspectRatio: 1, backgroundColor: palette.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  details: { padding: spacing.sm, gap: 4 },
  sku: { fontSize: 10, color: palette.muted },
  name: { ...typography.bodyMedium, color: palette.text, fontWeight: '700', minHeight: 38 },
  price: { ...typography.subtitle, color: palette.text, fontWeight: '900' },
  locked: { ...typography.caption, color: palette.textSecondary },
  seller: { ...typography.caption, color: palette.textSecondary },
  meta: { fontSize: 10, color: palette.muted },
  empty: { padding: spacing.xxl, alignItems: 'center', gap: spacing.md },
  emptyText: { ...typography.body, color: palette.textSecondary, textAlign: 'center' },
  error: { padding: spacing.md, backgroundColor: palette.surfaceSecondary, borderRadius: radius.md },
  errorText: { ...typography.caption, color: palette.text },
  retry: { backgroundColor: '#FACC15', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
  retryText: { color: '#111827', fontWeight: '800' },
  footerBack: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.lg, alignSelf: 'flex-start' },
  footerBackText: { ...typography.bodyMedium, color: palette.text, fontWeight: '700' },
});
