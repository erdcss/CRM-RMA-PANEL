import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { absoluteMediaUrl, rmaApi, type B2BProduct } from '@/lib/api';
import { asCatalogProduct, isMarketplaceProduct } from '@/lib/marketplace-products';
import { addToOrderList } from '@/lib/b2b-order-list';
import { appAlert } from '@/lib/appAlert';

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
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; slug?: string }>();
  const { session } = useAuth();

  const [product, setProduct] = useState<B2BProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companyLogo,setCompanyLogo]=useState<string|null>(null);
  const [quantity, setQuantity] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if(successTimer.current) clearTimeout(successTimer.current); }, []);
  const progress = useRef(new Animated.Value(0)).current;
  const [detailsHeight, setDetailsHeight] = useState(0);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: drawerOpen ? 1 : 0,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // Height and opacity move together for a true sliding drawer.
    });
    animation.start();
    return () => animation.stop();
  }, [drawerOpen, progress]);

  const id = String(params.id || '');
  const marketplaceId = id.startsWith('mp-') ? Number(id.slice(3)) : null;
  const sellerSlug = String(params.slug || '');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');

    const request = marketplaceId && sellerSlug
      ? rmaApi.getMarketplaceProduct(sellerSlug, marketplaceId).then(asCatalogProduct)
      : rmaApi.getB2BProduct(id);
    request
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
  }, [id, sellerSlug, session?.access_token]);

  useEffect(() => {
    if (!product || isMarketplaceProduct(product)) return;
    let active=true;
    void rmaApi.getPublicBranding()
      .then(branding=>{
        if (active) setCompanyLogo(absoluteMediaUrl(branding.b2b_mobile_logo || branding.b2b_logo));
      })
      .catch(()=>{ /* Use the store icon if the branding service is unavailable. */ });
    return () => { active=false; };
  }, [product?.id, product?.seller_slug]);

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
      <Screen style={{ backgroundColor: palette.background }}>
        <View style={styles.centerState}>
          <Ionicons name="cube-outline" size={38} color={palette.muted} />
          <Text style={styles.stateTitle}>Ürün yükleniyor…</Text>
        </View>
      </Screen>
    );
  }

  if (!product || error) {
    return (
      <Screen style={{ backgroundColor: palette.background }}>
        <View style={styles.centerState}>
          <Ionicons name="cube-outline" size={38} color={palette.muted} />
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
  const isSellerProduct = isMarketplaceProduct(product);
  const loggedIn =
    session?.user?.role === 'b2b_customer' && session?.user?.isActive === true;

  return (
    <Screen style={{ backgroundColor: palette.background }} edges={['top','bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={palette.textSecondary} />
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
          <Text style={styles.name}>{product.name || 'Ürün'}</Text>
          <View style={styles.productAttributes} accessibilityLabel="Ürün bilgileri">
            {([
              {key:'barcode',label:'Barkod Numarası',value:product.barcode || 'Belirtilmemiş'},
              {key:'sku',label:'Stok Kodu',value:product.sku || 'Belirtilmemiş'},
              {key:'brand',label:'Marka',value:product.brand || 'Belirtilmemiş'},
              {key:'category',label:'Kategori',value:product.category || 'Belirtilmemiş'},
            ] as const).map(field => (
              <View key={field.key} style={[styles.attributeCell,{borderColor:palette.border,backgroundColor:palette.surfaceSecondary}]}>
                <Text style={[styles.attributeLabel,{color:palette.textSecondary}]}>{field.label}</Text>
                <Text selectable numberOfLines={2} style={[styles.attributeValue,{color:palette.text}]}>{field.value}</Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSellerProduct ? `${product.seller_name || 'Satıcı'} mağazasını görüntüle` : 'Çalışkan B2B ürünlerini görüntüle'}
            onPress={() => {
              if (isSellerProduct && product.seller_slug) {
                router.push({pathname:'/marketplace/store/[slug]',params:{slug:product.seller_slug}} as never);
              } else {
                router.push('/(tabs)' as never);
              }
            }}
            style={[styles.sellerCard,{backgroundColor:palette.surfaceSecondary,borderColor:palette.border}]}
          >
            <View style={{height:44,width:44,borderRadius:11,backgroundColor:palette.surface,alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
              {(isSellerProduct ? product.seller_logo_url : companyLogo) ? (
                <Image
                  source={{uri:absoluteMediaUrl(isSellerProduct ? product.seller_logo_url : companyLogo)||undefined}}
                  style={{height:'100%',width:'100%'}} contentFit="contain"
                />
              ) : (
                <Ionicons name="storefront-outline" size={24} color={palette.textSecondary}/>
              )}
            </View>
            <View style={{flex:1}}>
              <Text numberOfLines={1} style={{fontWeight:'800',fontSize:14,color:palette.text}}>
                {isSellerProduct ? (product.seller_name || 'Onaylı tedarikçi') : 'Çalışkan B2B'}
              </Text>
              <Text style={{fontSize:12,color:palette.accent,marginTop:3,fontWeight:'700'}}>
                {isSellerProduct ? 'Mağazayı görüntüle →' : 'Çalışkan mağazasını gör →'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" color={palette.textSecondary} size={20}/>
          </Pressable>{product.description ? (
            <View style={styles.descriptionBox}>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          ) : null}

          {product.collection_name ? (
            <Text style={styles.collection}>{product.collection_name}</Text>
          ) : null}

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

          {Array.isArray(product.features) && product.features.length > 0 ? (
            <View style={styles.features}>
              <Text style={styles.featuresTitle}>Ürün Özellikleri</Text>
              {product.features.map((feature, index) => (
                <View key={`${feature}-${index}`} style={styles.featureRow}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={palette.textSecondary}
                  />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.shippingBox}>
            <Ionicons name="car-outline" size={21} color={palette.textSecondary} />
            <Text style={styles.shippingText}>
              {isSellerProduct
                ? 'Tedarikçi siparişiniz, satıcı onayı bekleyecek şekilde kaydedilir; ödeme henüz alınmaz.'
                : loggedIn
                  ? 'Siparişinizi desteklenen ödeme seçenekleriyle tamamlayabilirsiniz.'
                  : 'Sipariş ve sevkiyat seçenekleri giriş yaptıktan sonra aktif olur.'}
            </Text>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.dockContainer, { backgroundColor: palette.background }]}>
        <Animated.View
          pointerEvents={drawerOpen ? 'none' : 'auto'}
          importantForAccessibility={drawerOpen ? 'no-hide-descendants' : 'auto'}
          style={[
            styles.collapsedSummary,
            {
              backgroundColor: palette.surfaceSecondary,
              borderColor: palette.border,
              height: progress.interpolate({ inputRange: [0, 1], outputRange: [43, 0] }),
              opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0, 0] }),
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sipariş ayrıntılarını aç"
            onPress={() => setDrawerOpen(true)}
            style={styles.summaryPress}
          >
            <View style={styles.summaryField}>
              <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>GENEL TUTAR</Text>
              <Text style={[styles.summaryValue, { color: palette.text }]} numberOfLines={1}>
                {loggedIn && product.price != null ? money(total) : 'Giriş gerekli'}
              </Text>
            </View>
            <View style={styles.summaryField}>
              <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>SİPARİŞ EDİLEN ADET</Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>{effectiveQuantity * pack} adet</Text>
            </View>
            <Ionicons name="chevron-up" size={21} color={palette.text} />
          </Pressable>
        </Animated.View>
        <Animated.View
          pointerEvents={drawerOpen ? 'auto' : 'none'}
          importantForAccessibility={drawerOpen ? 'auto' : 'no-hide-descendants'}
          style={{
            height: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, detailsHeight],
            }),
            opacity: progress.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0, 0.15, 1] }),
            overflow: 'hidden',
          }}
        >
          <View
            onLayout={event => {
              const height = Math.ceil(event.nativeEvent.layout.height);
              if (height > 0 && height !== detailsHeight) setDetailsHeight(height);
            }}
            style={[styles.expandedPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sipariş ayrıntılarını kapat"
              onPress={() => setDrawerOpen(false)}
              style={styles.expandedHeader}
            >
              <Text style={[styles.expandedTitle, { color: palette.text }]}>Sipariş Detayları</Text>
              <Ionicons name="chevron-down" size={22} color={palette.text} />
            </Pressable>
            <View style={styles.dockFacts}>
              <View style={[styles.dockFact, { backgroundColor: palette.surfaceSecondary }]}>
                <Text style={[styles.dockLabel, { color: palette.textSecondary }]}>Sipariş koli</Text>
                <Text style={[styles.dockValue, { color: palette.text }]}>{effectiveQuantity} koli</Text>
              </View>
              <View style={[styles.dockFact, { backgroundColor: palette.surfaceSecondary }]}>
                <Text style={[styles.dockLabel, { color: palette.textSecondary }]}>Koli içi</Text>
                <Text style={[styles.dockValue, { color: palette.text }]}>{pack} adet</Text>
              </View>
              <View style={[styles.dockFact, { backgroundColor: palette.surfaceSecondary }]}>
                <Text style={[styles.dockLabel, { color: palette.textSecondary }]}>Toplam adet</Text>
                <Text style={[styles.dockValue, { color: palette.text }]}>{effectiveQuantity * pack}</Text>
              </View>
            </View>
            <View style={styles.detailLines}>
              <View style={styles.detailLine}>
                <Text style={[styles.dockLabel, { color: palette.textSecondary }]}>Birim ürün fiyatı</Text>
                <Text style={[styles.detailAmount, { color: palette.text }]}>
                  {loggedIn && product.price != null ? money(product.price) : 'Giriş gerekli'}
                </Text>
              </View>
              <View style={styles.detailLine}>
                <Text style={[styles.dockLabel, { color: palette.textSecondary }]}>Koli fiyatı</Text>
                <Text style={[styles.detailAmount, { color: palette.text }]}>
                  {loggedIn && product.price != null ? money(Number(product.price) * pack) : '—'}
                </Text>
              </View>
              <View style={styles.detailLine}>
                <Text style={[styles.dockLabel, { color: palette.textSecondary }]}>Minimum sipariş</Text>
                <Text style={[styles.detailAmount, { color: palette.text }]}>{min} koli</Text>
              </View>
              <View style={styles.detailLine}>
                <Text style={[styles.dockLabel, { color: palette.textSecondary }]}>Mevcut stok</Text>
                <Text style={[styles.detailAmount, { color: palette.text }]}>{stock} adet · {maxBoxes} koli</Text>
              </View>
            </View>
            <View style={styles.dockTotalRow}>
              <Text style={[styles.detailAmount, { color: palette.textSecondary }]}>Genel toplam</Text>
              <Text style={styles.expandedTotal}>
                {loggedIn && product.price != null ? money(total) : 'Giriş gerekli'}
              </Text>
            </View>
            {maxBoxes < min ? <Text style={styles.stockWarning}>Minimum sipariş için yeterli stok yok.</Text> : null}
          </View>
        </Animated.View>
        <View style={[styles.fixedOrderRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={[styles.compactStepper, { borderColor: palette.border }]}>
            <Pressable
              style={styles.compactStepButton}
              accessibilityLabel="Koli azalt"
              disabled={!loggedIn || adding || effectiveQuantity <= min}
              onPress={() => setQuantity(Math.max(min, effectiveQuantity - 1))}
            >
              <Ionicons name="remove" size={19} color={!loggedIn || effectiveQuantity <= min ? palette.muted : palette.text} />
            </Pressable>
            <Text style={[styles.compactStepValue, { color: palette.text }]}>{effectiveQuantity}</Text>
            <Pressable
              style={styles.compactStepButton}
              accessibilityLabel="Koli artır"
              disabled={!loggedIn || adding || effectiveQuantity >= maxBoxes}
              onPress={() => setQuantity(Math.min(maxBoxes, effectiveQuantity + 1))}
            >
              <Ionicons name="add" size={19} color={!loggedIn || effectiveQuantity >= maxBoxes ? palette.muted : palette.text} />
            </Pressable>
          </View>
          <View style={styles.unitPriceColumn}>
            <Text style={[styles.unitPriceLabel, { color: palette.textSecondary }]}>ÜRÜN FİYATI / ADET</Text>
            <Text style={[styles.unitPriceValue, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {loggedIn && product.price != null ? money(product.price) : 'Giriş gerekli'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={loggedIn ? (added ? 'Siparişlere eklendi' : 'Siparişlere ekle') : 'İşletme hesabıyla giriş yap'}
            style={[styles.fixedCartButton, added && styles.fixedCartSuccess, (adding || (loggedIn && maxBoxes < min)) && styles.disabledButton]}
            disabled={adding || (loggedIn && maxBoxes < min)}
            onPress={async () => {
              if (!loggedIn) {
                router.push('/login');
                return;
              }
              if (adding) return;
              setAdding(true);
              try {
                await addToOrderList({
                  productId: String(product.id), sku: String(product.sku || ''),
                  name: product.name || 'Ürün', image, unitPrice: Number(product.price || 0),
                  unitsPerBox: pack, boxQuantity: effectiveQuantity, minOrderQty: min, stock,
                  ...(isSellerProduct ? {
                    marketplaceProductId: Number(product.marketplace_product_id),
                    sellerSlug: product.seller_slug,
                    sellerName: product.seller_name,
                  } : {}),
                });
                setAdded(true);
                if(successTimer.current)clearTimeout(successTimer.current);
                successTimer.current=setTimeout(()=>setAdded(false),2400);
                appAlert('Siparişlere eklendi', product.name + ' · ' + effectiveQuantity + ' koli sipariş listenize eklendi.', undefined, 'success');
              } catch (e) {
                appAlert('Ürün eklenemedi', e instanceof Error ? e.message : 'Tekrar deneyin.');
              } finally {
                setAdding(false);
              }
            }}
          >
            <Ionicons name={loggedIn ? 'cart-outline' : 'log-in-outline'} size={17} color="#111827" />
            <Text style={styles.fixedCartText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {adding ? 'Ekleniyor…' : !loggedIn ? 'Giriş Yap' : added ? 'Siparişlere Eklendi' : 'Siparişlere Ekle'}
            </Text>
          </Pressable>
        </View>
      </View>
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
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  return (
    <View style={styles.infoCard}>
      <Ionicons name={icon} size={18} color={palette.textSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const buildStyles = (palette: AppPalette) => StyleSheet.create({
  sellerCard:{marginTop:14,padding:12,borderRadius:12,borderWidth:1,flexDirection:'row',alignItems:'center',gap:10},
  dockContainer: { paddingTop: 0 },
  collapsedSummary: {
    marginHorizontal: 14,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  summaryPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 10,
  },
  summaryField: { flex: 1, minWidth: 0 },
  summaryLabel: { fontSize: 9, fontWeight: '700' },
  summaryValue: { fontSize: 13, fontWeight: '900', marginTop: 2 },
  expandedPanel: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 17,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  expandedHeader: {
    minHeight: 39,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  expandedTitle: { fontSize: 16, fontWeight: '900' },
  dockLabel: { fontSize: 11, fontWeight: '600' },
  dockFacts: { flexDirection: 'row', gap: 7 },
  dockFact: { flex: 1, minWidth: 0, padding: 9, borderRadius: 10 },
  dockValue: { fontSize: 14, fontWeight: '800', marginTop: 5 },
  detailLines: { marginTop: 9 },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 30,
    gap: 10,
  },
  detailAmount: { fontSize: 12, fontWeight: '800', textAlign: 'right' },
  dockTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: palette.border,
    marginTop: 10,
    paddingTop: 11,
  },
  expandedTotal: { fontSize: 20, fontWeight: '900', color: '#FACC15' },
  fixedOrderRow: {
    borderTopWidth: 1,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactStepper: {
    height: 46,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  compactStepButton: { width: 34, height: 44, alignItems: 'center', justifyContent: 'center' },
  compactStepValue: { minWidth: 29, textAlign: 'center', fontWeight: '900', color: palette.text, fontSize: 14 },
  unitPriceColumn: { flex: 1, minWidth: 0 },
  unitPriceLabel: { fontSize: 9, fontWeight: '600' },
  unitPriceValue: { fontSize: 13, fontWeight: '900', marginTop: 3 },
  fixedCartButton: {
    minHeight: 46,
    minWidth: 96,
    maxWidth: 128,
    borderRadius: 11,
    backgroundColor: '#FFCD00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
  },
  fixedCartSuccess: { backgroundColor: '#22C55E' },
  fixedCartText: { fontSize: 11, fontWeight: '900', color: '#111827', flexShrink: 1 },

  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  back: {
    minHeight: minTouchTarget,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  backText: {
    ...typography.bodyMedium,
    color: palette.textSecondary,
  },
  imageCard: {
    aspectRatio: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
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
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  productAttributes:{
    marginTop:spacing.md,
    flexDirection:'row',
    flexWrap:'wrap',
    gap:8,
  },
  attributeCell:{
    flexGrow:1,
    flexBasis:'47%',
    minWidth:130,
    borderWidth:1,
    borderRadius:radius.md,
    paddingHorizontal:12,
    paddingVertical:10,
    minHeight:59,
    justifyContent:'center',
  },
  attributeLabel:{
    fontSize:11,
    fontWeight:'400',
    marginBottom:4,
  },
  attributeValue:{
    fontSize:13,
    fontWeight:'600',
  },
  sku: {
    ...typography.caption,
    color: palette.muted,
  },
  skuStrong: {
    color: palette.textSecondary,
    fontWeight: '700',
  },
  name: {
    ...typography.title,
    color: palette.text,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  descriptionBox: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceSecondary,
    padding: spacing.md,
  },
  description: {
    ...typography.body,
    color: palette.textSecondary,
  },
  collection: {
    ...typography.body,
    color: palette.muted,
    marginTop: spacing.sm,
  },
  priceSection: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.border,
    paddingVertical: spacing.lg,
  },
  priceLabel: {
    ...typography.body,
    color: palette.muted,
  },
  price: {
    ...typography.largeTitle,
    color: palette.text,
    fontWeight: '900',
    marginTop: 2,
  },
  priceNote: {
    ...typography.caption,
    color: palette.muted,
    marginTop: spacing.xs,
  },
  lockedPrice: {
    ...typography.subtitle,
    color: palette.text,
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
    gap: 7,
  },
  infoCard: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor:palette.surfaceSecondary,
    paddingHorizontal:spacing.md,
    flexDirection:'row',
    alignItems:'center',
    gap:10,
  },
  infoLabel:{...typography.caption,color:palette.textSecondary,flex:1},
  infoValue:{...typography.bodyMedium,color:palette.text,fontWeight:'800'},
  orderCard: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
  },
  orderTitle: {
    ...typography.bodyMedium,
    color: palette.text,
    fontWeight: '800',
  },
  orderSubtitle: {
    ...typography.caption,
    color: palette.muted,
    marginTop: 2,
  },
  quantityControl: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  quantityButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  quantityValue: {
    minWidth: 58,
    height: 44,
    textAlign: 'center',
    textAlignVertical: 'center',
    ...typography.bodyMedium,
    color: palette.text,
    fontWeight: '900',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: palette.border,
    lineHeight: 44,
  },
  totalBox: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceSecondary,
    padding: spacing.md,
  },
  totalLabel: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  totalValue: {
    ...typography.subtitle,
    color: palette.text,
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
    backgroundColor: '#FACC15',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  checkoutButtonText: {
    ...typography.bodyMedium,
    color: '#111827',
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
    color: palette.text,
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
    color: palette.textSecondary,
    flex: 1,
  },
  shippingBox: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceSecondary,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shippingText: {
    ...typography.body,
    color: palette.textSecondary,
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
    color: palette.text,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  stateText: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
