import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { absoluteMediaUrl, rmaApi, type B2BProduct } from '@/lib/api';
import { useMobileBranding } from '@/lib/branding';

function money(value: string | number | null | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

function productImage(product: B2BProduct) {
  const raw =
    (typeof product.image_data === 'string' && product.image_data.trim()
      ? product.image_data
      : Array.isArray(product.images)
        ? product.images.find((item) => typeof item === 'string' && item.trim())
        : null) || null;

  return absoluteMediaUrl(raw);
}

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const branding = useMobileBranding();
  const { session } = useAuth();

  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [productResult, homepageResult] = await Promise.allSettled([
      rmaApi.listB2BProducts(),
      rmaApi.getB2BHomepage(),
    ]);

    if (productResult.status === 'fulfilled') {
      setProducts(Array.isArray(productResult.value) ? productResult.value : []);
    }

    if (homepageResult.status === 'fulfilled') {
      setCategories(homepageResult.value.categories || []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, session?.access_token]);

  useEffect(() => {
    if (typeof params.category === 'string') {
      setSelectedCategory(params.category);
    }
  }, [params.category]);

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('tr-TR');
    const category = selectedCategory.trim().toLocaleLowerCase('tr-TR');

    return products.filter((product) => {
      const matchesCategory =
        !category ||
        String(product.category || '').toLocaleLowerCase('tr-TR') === category;

      const matchesSearch =
        !search ||
        [product.name, product.sku, product.barcode, product.collection_name]
          .filter(Boolean)
          .some((value) =>
            String(value).toLocaleLowerCase('tr-TR').includes(search),
          );

      return matchesCategory && matchesSearch;
    });
  }, [products, query, selectedCategory]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
        contentContainerStyle={styles.page}
      >
        <View style={styles.topRow}>
          <Image
            source={
              branding.b2b_mobile_logo
                ? { uri: branding.b2b_mobile_logo }
                : require('../../assets/logo.png')
            }
            style={styles.logo}
            contentFit="contain"
          />

          <Pressable style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ürün veya stok kodu ara"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={19} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Kategoriler</Text>
            <Text style={styles.sectionSubtitle}>Ürün grubunu seçin</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/menu')}>
            <Text style={styles.sectionAction}>Tümü</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          <Pressable
            onPress={() => setSelectedCategory('')}
            style={[
              styles.categoryCard,
              !selectedCategory && styles.categoryCardActive,
            ]}
          >
            <Ionicons
              name="apps-outline"
              size={24}
              color={!selectedCategory ? '#FFFFFF' : colors.text}
            />
            <Text
              style={[
                styles.categoryText,
                !selectedCategory && styles.categoryTextActive,
              ]}
            >
              Tümü
            </Text>
          </Pressable>

          {categories.map((category, index) => {
            const active =
              category.toLocaleLowerCase('tr-TR') ===
              selectedCategory.toLocaleLowerCase('tr-TR');
            const icons: Array<keyof typeof Ionicons.glyphMap> = [
              'home-outline',
              'flash-outline',
              'basket-outline',
              'construct-outline',
              'storefront-outline',
              'cube-outline',
            ];

            return (
              <Pressable
                key={category}
                onPress={() => setSelectedCategory(category)}
                style={[styles.categoryCard, active && styles.categoryCardActive]}
              >
                <Ionicons
                  name={icons[index % icons.length]}
                  size={24}
                  color={active ? '#FFFFFF' : colors.text}
                />
                <Text
                  numberOfLines={2}
                  style={[
                    styles.categoryText,
                    active && styles.categoryTextActive,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Yeni Gelen Ürünler</Text>
            <Text style={styles.sectionSubtitle}>
              Çalışkan B2B kataloğuna son eklenenler
            </Text>
          </View>
          <Text style={styles.productCount}>{filtered.length} ürün</Text>
        </View>

        <View style={styles.productGrid}>
          {filtered.slice(0, 10).map((product) => {
            const image = productImage(product);
            const priceVisible =
              Boolean(session) &&
              product.price !== null &&
              product.price !== undefined;

            return (
              <Pressable
                key={String(product.id)}
                style={styles.productCard}
                onPress={() =>
                  router.push({
                    pathname: '/product/[id]',
                    params: { id: String(product.id) },
                  } as never)
                }
              >
                <View style={styles.productImageWrap}>
                  {image ? (
                    <Image
                      source={{ uri: image }}
                      style={styles.productImage}
                      contentFit="contain"
                    />
                  ) : (
                    <Ionicons
                      name="cube-outline"
                      size={38}
                      color={colors.textMuted}
                    />
                  )}
                </View>

                <View style={styles.productBody}>
                  <Text style={styles.sku}>{product.sku || 'STOK'}</Text>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>

                  {priceVisible ? (
                    <Text style={styles.price}>{money(product.price)}</Text>
                  ) : (
                    <Pressable
                      style={styles.lockedPrice}
                      onPress={() => router.push('/login')}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={13}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.lockedPriceText}>
                        Fiyat bilgisi giriş yapıldıktan sonra listelenir
                      </Text>
                    </Pressable>
                  )}

                  <Text style={styles.meta}>
                    Koli içi {Number(product.units_per_box || 1)} · Min.{' '}
                    {Number(product.min_order_qty || 1)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Ürün bulunamadı</Text>
            <Text style={styles.emptyText}>
              Arama veya kategori filtresini değiştirin.
            </Text>
          </View>
        ) : null}

        {!session ? (
          <Pressable
            style={styles.memberBanner}
            onPress={() => router.push('/login')}
          >
            <View style={styles.memberIcon}>
              <Ionicons name="business-outline" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.memberText}>
              <Text style={styles.memberTitle}>B2B fiyatlarını görüntüleyin</Text>
              <Text style={styles.memberSubtitle}>
                İşletme hesabınızla giriş yaparak size özel fiyatlara ulaşın.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
  },
  topRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 150,
    height: 44,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: colors.surface,
  },
  searchBox: {
    marginTop: spacing.md,
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  sectionHeader: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.title2,
    color: colors.text,
    fontWeight: '800',
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionAction: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '700',
  },
  productCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  categories: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  categoryCard: {
    width: 96,
    minHeight: 104,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  categoryCardActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  categoryText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  productCard: {
    width: '48%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  productImageWrap: {
    aspectRatio: 1,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productBody: {
    padding: spacing.md,
  },
  sku: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  productName: {
    ...typography.bodyMedium,
    color: colors.text,
    minHeight: 42,
    marginTop: 3,
    fontWeight: '700',
  },
  price: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.sm,
    fontWeight: '800',
  },
  lockedPrice: {
    marginTop: spacing.sm,
    minHeight: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  lockedPriceText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: spacing.sm,
  },
  emptyState: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  memberBanner: {
    marginTop: spacing.xxl,
    borderRadius: radius.xl,
    backgroundColor: '#111827',
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberText: {
    flex: 1,
  },
  memberTitle: {
    ...typography.subtitle,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  memberSubtitle: {
    ...typography.caption,
    color: '#CBD5E1',
    marginTop: 2,
  },
});
