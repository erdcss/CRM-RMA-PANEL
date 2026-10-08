import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { absoluteMediaUrl, rmaApi, type B2BProduct } from '@/lib/api';

function money(value: string | number | null | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

function productImage(product?: B2BProduct | null) {
  if (!product) return null;
  const raw =
    product.image_data ||
    product.image_url ||
    (Array.isArray(product.images) ? product.images[0] : null) ||
    null;
  return absoluteMediaUrl(raw);
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();

  const [product, setProduct] = useState<B2BProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);

  const id = String(params.id || '');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');

    rmaApi
      .getB2BProduct(id)
      .then((value) => {
        setProduct(value);
        setQuantity(Math.max(1, Number(value.min_order_qty || 1)));
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error ? loadError.message : 'Ürün yüklenemedi.',
        );
      })
      .finally(() => setLoading(false));
  }, [id, session?.access_token]);

  const pack = Math.max(1, Number(product?.units_per_box || 1));
  const min = Math.max(1, Number(product?.min_order_qty || 1));
  const stock = Math.max(0, Number(product?.stock || 0));
  const maxBoxes = Math.max(0, Math.floor(stock / pack));
  const effectiveQuantity = Math.min(
    maxBoxes || min,
    Math.max(min, quantity < min ? min : quantity),
  );

  const total = useMemo(() => {
    if (!product?.price) return 0;
    return Number(product.price) * pack * effectiveQuantity;
  }, [product?.price, pack, effectiveQuantity]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.centerState}>
          <Ionicons name="cube-outline" size={38} color={colors.textMuted} />
          <Text style={styles.stateTitle}>Ürün yükleniyor…</Text>
        </View>
      </Screen>
    );
  }

  if (!product || error) {
    return (
      <Screen>
        <View style={styles.centerState}>
          <Ionicons name="cube-outline" size={38} color={colors.textMuted} />
          <Text style={styles.stateTitle}>Ürün bulunamadı</Text>
          <Text style={styles.stateText}>{error || 'Ürün bilgisine ulaşılamadı.'}</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Ürünlere Dön</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const image = productImage(product);
  const loggedIn =
    session?.user?.role === 'b2b_customer' && session?.user?.isActive === true;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          <Text style={styles.backText}>Ürünlere dön</Text>
        </Pressable>

        <View style={styles.imageCard}>
          {image ? (
            <Image
              source={{ uri: image }}
              style={styles.productImage}
              contentFit="contain"
            />
          ) : (
            <Ionicons name="cube-outline" size={72} color={colors.border} />
          )}
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.sku}>
            Stok Kodu: <Text style={styles.skuStrong}>{product.sku || '—'}</Text>
          </Text>

          <Text style={styles.name}>{product.name || 'Ürün'}</Text>

          {product.description ? (
            <View style={styles.descriptionBox}>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          ) : null}

          {product.collection_name ? (
            <Text style={styles.collection}>{product.collection_name}</Text>
          ) : null}

          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>B2B fiyatı</Text>
            {loggedIn && product.price != null ? (
              <>
                <Text style={styles.price}>{money(product.price)}</Text>
                <Text style={styles.priceNote}>
                  Birim fiyat · Koli içi {pack} adet
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.lockedPrice}>
                  Fiyat bilgisi giriş yapıldıktan sonra listelenir
                </Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => router.push('/login')}
                >
                  <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>
                    İşletme Hesabıyla Giriş Yap
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.infoGrid}>
            <InfoCard
              icon="albums-outline"
              label="Koli içi"
              value={`${pack} adet`}
            />
            <InfoCard
              icon="storefront-outline"
              label="Stok"
              value={`${stock} adet · ${maxBoxes} koli`}
            />
            <InfoCard
              icon="shield-checkmark-outline"
              label="Minimum"
              value={`${min} koli`}
            />
          </View>

          {loggedIn ? (
            <View style={styles.orderCard}>
              <Text style={styles.orderTitle}>Sipariş edilen koli adedi</Text>
              <Text style={styles.orderSubtitle}>
                Minimum {min} koli · En fazla {maxBoxes} koli · {pack} adet/koli
              </Text>

              <View style={styles.quantityControl}>
                <Pressable
                  style={styles.quantityButton}
                  disabled={effectiveQuantity <= min}
                  onPress={() =>
                    setQuantity(Math.max(min, effectiveQuantity - 1))
                  }
                >
                  <Ionicons
                    name="remove"
                    size={20}
                    color={
                      effectiveQuantity <= min ? colors.textMuted : colors.text
                    }
                  />
                </Pressable>

                <Text style={styles.quantityValue}>{effectiveQuantity}</Text>

                <Pressable
                  style={styles.quantityButton}
                  disabled={effectiveQuantity >= maxBoxes}
                  onPress={() =>
                    setQuantity(Math.min(maxBoxes, effectiveQuantity + 1))
                  }
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color={
                      effectiveQuantity >= maxBoxes
                        ? colors.textMuted
                        : colors.text
                    }
                  />
                </Pressable>
              </View>

              {maxBoxes < min ? (
                <Text style={styles.stockWarning}>
                  Tam koli siparişi için yeterli stok bulunmuyor.
                </Text>
              ) : (
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>
                    {effectiveQuantity} koli × {pack} adet ={' '}
                    {effectiveQuantity * pack} adet
                  </Text>
                  <Text style={styles.totalValue}>Toplam {money(total)}</Text>
                </View>
              )}

              <Pressable
                style={[
                  styles.checkoutButton,
                  maxBoxes < min && styles.disabledButton,
                ]}
                disabled={maxBoxes < min}
                onPress={() =>
                  router.push({
                    pathname: '/checkout',
                    params: {
                      productId: String(product.id),
                      qty: String(effectiveQuantity),
                    },
                  } as never)
                }
              >
                <Ionicons name="bag-check-outline" size={19} color="#FFFFFF" />
                <Text style={styles.checkoutButtonText}>
                  Siparişi Tamamla
                </Text>
              </Pressable>
            </View>
          ) : null}

          {Array.isArray(product.features) && product.features.length > 0 ? (
            <View style={styles.features}>
              <Text style={styles.featuresTitle}>Ürün Özellikleri</Text>
              {product.features.map((feature, index) => (
                <View key={`${feature}-${index}`} style={styles.featureRow}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.shippingBox}>
            <Ionicons name="car-outline" size={21} color={colors.textSecondary} />
            <Text style={styles.shippingText}>
              {loggedIn
                ? 'Siparişinizi kart veya Havale/EFT ile tamamlayabilirsiniz.'
                : 'Sipariş ve sevkiyat seçenekleri giriş yaptıktan sonra aktif olur.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoCard}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  back: {
    minHeight: minTouchTarget,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  backText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  imageCard: {
    aspectRatio: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  detailCard: {
    marginTop: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  sku: {
    ...typography.caption,
    color: colors.textMuted,
  },
  skuStrong: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  name: {
    ...typography.title,
    color: colors.text,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  descriptionBox: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  collection: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  priceSection: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.lg,
  },
  priceLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  price: {
    ...typography.largeTitle,
    color: colors.text,
    fontWeight: '900',
    marginTop: 2,
  },
  priceNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  lockedPrice: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  primaryButton: {
    minHeight: 50,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  infoGrid: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  infoCard: {
    flex: 1,
    minHeight: 110,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '800',
    marginTop: 2,
  },
  orderCard: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  orderTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '800',
  },
  orderSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  quantityControl: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  quantityButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  quantityValue: {
    minWidth: 58,
    height: 44,
    textAlign: 'center',
    textAlignVertical: 'center',
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '900',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    lineHeight: 44,
  },
  totalBox: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  totalValue: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  stockWarning: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.md,
    fontWeight: '700',
  },
  checkoutButton: {
    minHeight: 52,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  checkoutButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.5,
  },
  features: {
    marginTop: spacing.lg,
  },
  featuresTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  featureText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  shippingBox: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shippingText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  stateTitle: {
    ...typography.title,
    color: colors.text,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  stateText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
