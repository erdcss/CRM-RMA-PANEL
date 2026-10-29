import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { radius, spacing, typography } from '@/constants/theme';
import { absoluteMediaUrl, rmaApi, type B2BProduct } from '@/lib/api';
import { asCatalogProduct, productParams } from '@/lib/marketplace-products';

const SORT_OPTIONS = [
  { id: 'newest', label: 'Yeni' },
  { id: 'name', label: 'A-Z' },
  { id: 'priceAsc', label: 'Fiyat ↑' },
  { id: 'priceDesc', label: 'Fiyat ↓' },
] as const;

type ProductSort = (typeof SORT_OPTIONS)[number]['id'];

function money(value: string | number | null | undefined) {
  if (value === null || value === undefined || String(value).trim() === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ₺';
}

function productImage(product: B2BProduct) {
  if (typeof product.image_data === 'string' && product.image_data.trim()) {
    return absoluteMediaUrl(product.image_data);
  }
  if (Array.isArray(product.images)) {
    const first = product.images.find(
      (item) => typeof item === 'string' && item.trim(),
    );
    if (first) return absoluteMediaUrl(first);
  }
  return null;
}

export default function ProductsScreen() {
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  const router = useRouter();
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ProductSort>('newest');
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadProducts = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const results = await Promise.allSettled([
        rmaApi.listB2BProducts(refresh),
        rmaApi.listMarketplaceProducts(),
      ]);
      if (results.every((result) => result.status === 'rejected')) {
        throw new Error('Ürün kataloglarına ulaşılamadı.');
      }
      const own = results[0].status === 'fulfilled' && Array.isArray(results[0].value)
        ? results[0].value : [];
      const suppliers = results[1].status === 'fulfilled' && Array.isArray(results[1].value)
        ? results[1].value.map(asCatalogProduct) : [];
      setProducts([...suppliers, ...own]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Ürünler yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts, session?.access_token]);

  const sorted = useMemo(() => {
    const rows = [...products];
    if (sort === 'name') {
      rows.sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
    } else if (sort === 'priceAsc' || sort === 'priceDesc') {
      rows.sort((a, b) => {
        const ap = a.price == null || String(a.price).trim() === '' ? Infinity : Number(a.price);
        const bp = b.price == null || String(b.price).trim() === '' ? Infinity : Number(b.price);
        if (!Number.isFinite(ap)) return Number.isFinite(bp) ? 1 : 0;
        if (!Number.isFinite(bp)) return -1;
        return sort === 'priceAsc' ? ap - bp : bp - ap;
      });
    }
    return rows;
  }, [products, sort]);

  const filteredProducts = useMemo(() => {
    const value = query.trim().toLocaleLowerCase('tr-TR');
    if (!value) return sorted;
    return sorted.filter((product) =>
      [
        product.name,
        product.sku,
        product.barcode,
        product.collection_name,
        product.seller_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR')
        .includes(value)
    );
  }, [sorted, query]);

  return (
    <Screen style={{ backgroundColor: palette.background }}>
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadProducts(true)}
            tintColor={palette.accent}
          />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>ÇALIŞKAN B2B</Text>
                <Text style={styles.title}>Ürünler</Text>
                <Text style={styles.subtitle}>Ürünleri keşfedin ve fiyatları inceleyin.</Text>
              </View>
              {!session ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Giriş yap"
                  style={styles.loginButton}
                  onPress={() => router.push('/login')}
                >
                  <Ionicons name="log-in-outline" size={18} color={palette.accentText} />
                  <Text style={styles.loginButtonText}>Giriş Yap</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.catalogRow}>
              <View style={styles.countBadge}>
                <Ionicons name="cube-outline" size={15} color={palette.accentText} />
                <Text style={styles.countText}>{filteredProducts.length} ürün</Text>
              </View>
              <Text style={styles.catalogCaption}>B2B ürün kataloğu</Text>
            </View>

            {!session ? (
              <View style={styles.guestNotice}>
                <Ionicons name="lock-closed-outline" size={18} color={palette.accent} />
                <Text style={styles.guestNoticeText}>
                  Fiyatları görmek için hesabınıza giriş yapın.
                </Text>
              </View>
            ) : null}

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={21} color={palette.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Ürün, barkod veya satıcı ara"
                placeholderTextColor={palette.muted}
                style={styles.searchInput}
                returnKeyType="search"
                accessibilityLabel="Ürün ara"
              />
              {query.length > 0 ? (
                <Pressable
                  onPress={() => setQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel="Aramayı temizle"
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={20} color={palette.muted} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.sortRow}>
              {SORT_OPTIONS.map((option) => {
                const active = sort === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setSort(option.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.sortButton, active && styles.sortButtonActive]}
                  >
                    <Text style={[styles.sortText, active && styles.sortTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => {
          const image = productImage(item);
          const validPrice = item.price !== null && item.price !== undefined
            && String(item.price).trim() !== '' && Number.isFinite(Number(item.price));
          const hasPrice = Boolean(session && validPrice);

          return (
            <Pressable
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={item.name || 'Ürün detayını aç'}
              onPress={() =>
                router.push({
                  pathname: '/product/[id]',
                  params: productParams(item),
                } as never)
              }
            >
              <View style={styles.cardMain}>
                <View style={styles.imageBox}>
                  {image ? (
                    <Image
                      source={{ uri: image }}
                      style={styles.image}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Ionicons name="cube-outline" size={34} color={palette.muted} />
                  )}
                </View>
                <View style={styles.productBody}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {item.name || 'Ürün'}
                  </Text>
                  {item.seller_name ? (
                    <Text style={styles.sellerText} numberOfLines={1}>{item.seller_name}</Text>
                  ) : null}
                  <Text style={styles.metaText} numberOfLines={1}>
                    Stok Kodu: {item.sku || '—'}
                  </Text>
                  {item.units_per_box ? (
                    <Text style={styles.metaText}>Koli içi: {Number(item.units_per_box)} adet</Text>
                  ) : null}
                  {item.min_order_qty ? (
                    <Text style={styles.minOrder}>
                      Minimum alım: {Number(item.min_order_qty)} koli
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.priceArea}>
                <View style={styles.priceLabelWrap}>
                  <Ionicons name="pricetag-outline" size={16} color={palette.accent} />
                  <Text style={styles.priceLabel}>B2B Fiyatı</Text>
                </View>
                {hasPrice ? (
                  <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit>
                    {money(item.price)}
                  </Text>
                ) : !session ? (
                  <Pressable
                    style={styles.lockedPrice}
                    accessibilityRole="button"
                    accessibilityLabel="Fiyat için giriş yap"
                    onPress={() => router.push('/login')}
                  >
                    <Ionicons name="lock-closed-outline" size={13} color={palette.accent} />
                    <Text style={styles.lockedPriceText}>Giriş Yap</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.unavailablePrice}>Fiyat belirtilmedi</Text>
                )}
              </View>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={loading ? (
          <LoadingState />
        ) : (
          <EmptyState
            icon="cube-outline"
            title="Ürün bulunamadı"
            description={
              query.trim()
                ? 'Aramanızla eşleşen ürün bulunamadı.'
                : 'B2B ürün kataloğunda henüz ürün bulunmuyor.'
            }
          />
        )}
      />
    </Screen>
  );
}

const buildStyles = (palette: AppPalette) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl + spacing.xxl,
    flexGrow: 1,
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: palette.accent,
  },
  title: {
    ...typography.largeTitle,
    color: palette.text,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.xs,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.accent,
    borderRadius: radius.full,
  },
  loginButtonText: {
    ...typography.caption,
    color: palette.accentText,
    fontWeight: '800',
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  countText: {
    ...typography.caption,
    color: palette.accentText,
    fontWeight: '800',
  },
  catalogCaption: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  guestNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  guestNoticeText: {
    ...typography.caption,
    color: palette.textSecondary,
    flex: 1,
  },
  searchWrap: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    ...typography.body,
    color: palette.text,
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.md,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sortButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  sortButtonActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  sortText: {
    ...typography.caption,
    color: palette.text,
    fontWeight: '800',
  },
  sortTextActive: { color: palette.accentText },
  card: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardMain: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  imageBox: {
    width: 108,
    height: 108,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  productBody: { flex: 1, minWidth: 0 },
  productName: {
    ...typography.subtitle,
    color: palette.text,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  sellerText: {
    ...typography.caption,
    color: palette.accent,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 3,
  },
  minOrder: {
    ...typography.caption,
    color: palette.text,
    marginTop: spacing.xs,
    fontWeight: '700',
  },
  priceArea: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
    backgroundColor: palette.surfaceSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  priceLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  priceLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: '700',
  },
  price: {
    ...typography.title2,
    color: palette.text,
    fontWeight: '900',
    textAlign: 'right',
    flexShrink: 1,
  },
  lockedPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  lockedPriceText: {
    ...typography.caption,
    color: palette.text,
    fontWeight: '700',
  },
  unavailablePrice: {
    ...typography.caption,
    color: palette.muted,
    fontWeight: '600',
  },
  separator: { height: spacing.sm + 2 },
  error: {
    ...typography.caption,
    color: '#F87171',
    marginTop: spacing.md,
  },
});
