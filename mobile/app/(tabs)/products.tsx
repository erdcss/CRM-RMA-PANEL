import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { CompactProductCard, gridProductWidth } from '@/components/products/CompactProductCard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { radius, spacing, typography } from '@/constants/theme';
import { rmaApi, type B2BProduct } from '@/lib/api';
import { asCatalogProduct, productParams } from '@/lib/marketplace-products';
import {trackTikTokProductSearch} from '@/lib/tiktok-commerce-events';

const SORT_OPTIONS = [
  { id: 'newest', label: 'Yeni' },
  { id: 'name', label: 'A-Z' },
  { id: 'priceAsc', label: 'Fiyat ↑' },
  { id: 'priceDesc', label: 'Fiyat ↓' },
] as const;

type ProductSort = (typeof SORT_OPTIONS)[number]['id'];

export default function ProductsScreen() {
  const { palette } = useAppearance();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = gridProductWidth(Math.max(1,screenWidth-2*spacing.lg));
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
        keyExtractor={(item) => (item.marketplace?'marketplace-':'b2b-')+String(item.id)}
        numColumns={2}
        columnWrapperStyle={{gap:spacing.sm}}
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
                onSubmitEditing={()=>{void trackTikTokProductSearch(query);}}
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
        renderItem={({item})=><CompactProductCard product={item} width={cardWidth} signedIn={Boolean(session)}
          onPress={()=>router.push({pathname:'/product/[id]',params:productParams(item)} as never)}
          onLogin={()=>router.push('/login')} onExpire={()=>void loadProducts(true)}/>}
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
  separator: { height: spacing.sm + 2 },
  error: {
    ...typography.caption,
    color: '#F87171',
    marginTop: spacing.md,
  },
});
