import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SearchInput } from '@/components/ui/SearchInput';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { rmaApi, type B2BProduct } from '@/lib/api';

function money(value: string | number | null | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ₺';
}

function productImage(product: B2BProduct) {
  if (typeof product.image_data === 'string' && product.image_data.trim()) {
    return product.image_data;
  }
  if (Array.isArray(product.images)) {
    const first = product.images.find(
      (item) => typeof item === 'string' && item.trim(),
    );
    if (first) return first;
  }
  return null;
}

export default function ProductsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadProducts = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const data = await rmaApi.listB2BProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Ürünler yüklenemedi.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts, session?.access_token]);

  const filteredProducts = useMemo(() => {
    const value = query.trim().toLocaleLowerCase('tr-TR');
    if (!value) return products;

    return products.filter((product) => {
      const searchable = [
        product.name,
        product.sku,
        product.barcode,
        product.collection_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR');
      return searchable.includes(value);
    });
  }, [products, query]);

  const rightSlot = !session ? (
    <Pressable style={styles.loginButton} onPress={() => router.push('/login')}>
      <Ionicons name="log-in-outline" size={17} color={colors.primary} />
      <Text style={styles.loginButtonText}>Giriş Yap</Text>
    </Pressable>
  ) : null;

  if (loading && products.length === 0) {
    return (
      <Screen>
        <AppHeader title="Ürünler" subtitle="Çalışkan B2B ürün kataloğu" rightSlot={rightSlot} />
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Ürünler"
        subtitle={`${filteredProducts.length} ürün`}
        rightSlot={rightSlot}
      />

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadProducts(true)}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            {!session ? (
              <View style={styles.guestNotice}>
                <View style={styles.guestNoticeIcon}>
                  <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.guestNoticeText}>
                  <Text style={styles.guestNoticeTitle}>Ürünleri giriş yapmadan inceleyebilirsiniz</Text>
                  <Text style={styles.guestNoticeSubtitle}>
                    Fiyat bilgisi giriş yapıldıktan sonra listelenir.
                  </Text>
                </View>
              </View>
            ) : null}

            <SearchInput
              value={query}
              onChangeText={setQuery}
              placeholder="Ürün adı, stok kodu veya barkod ara"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => {
          const image = productImage(item);
          const hasPrice = session && item.price !== null && item.price !== undefined;

          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/product/[id]',
                  params: { id: String(item.id) },
                } as never)
              }
            >
              <View style={styles.imageBox}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.image} contentFit="contain" />
                ) : (
                  <Ionicons name="cube-outline" size={34} color={colors.textMuted} />
                )}
              </View>

              <View style={styles.productBody}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.name || 'Ürün'}
                </Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>Stok Kodu: {item.sku || '—'}</Text>
                  {item.units_per_box ? (
                    <Text style={styles.metaText}>
                      Koli içi: {Number(item.units_per_box)} adet
                    </Text>
                  ) : null}
                </View>

                {item.min_order_qty ? (
                  <Text style={styles.minOrder}>
                    Minimum alım: {Number(item.min_order_qty)} koli
                  </Text>
                ) : null}

                <View style={styles.priceArea}>
                  {hasPrice ? (
                    <>
                      <Text style={styles.priceLabel}>B2B Fiyatı</Text>
                      <Text style={styles.price}>{money(item.price)}</Text>
                    </>
                  ) : (
                    <Pressable
                      style={styles.lockedPrice}
                      onPress={() => router.push('/login')}
                    >
                      <Ionicons name="lock-closed-outline" size={16} color={colors.primary} />
                      <Text style={styles.lockedPriceText}>
                        Fiyat bilgisi giriş yapıldıktan sonra listelenir
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title="Ürün bulunamadı"
            description={
              query.trim()
                ? 'Aramanızla eşleşen ürün bulunamadı.'
                : 'B2B ürün kataloğunda henüz ürün bulunmuyor.'
            }
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  header: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  guestNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  guestNoticeIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestNoticeText: {
    flex: 1,
  },
  guestNoticeTitle: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  guestNoticeSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  loginButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  loginButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  imageBox: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  productBody: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    ...typography.subtitle,
    color: colors.text,
  },
  metaRow: {
    marginTop: spacing.xs,
    gap: 2,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  minOrder: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  priceArea: {
    marginTop: spacing.md,
  },
  priceLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  price: {
    ...typography.title2,
    color: colors.text,
    marginTop: 2,
  },
  lockedPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  lockedPriceText: {
    ...typography.caption,
    color: colors.primaryDark,
    flex: 1,
    fontWeight: '600',
  },
  separator: {
    height: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
