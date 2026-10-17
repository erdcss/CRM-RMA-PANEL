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
  const [quantity, setQuantity] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adding, setAdding] = useState(false);

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
          <Text style={styles.sku}>
            Stok Kodu: <Text style={styles.skuStrong}>{product.sku || '—'}</Text>
          </Text>

          <Text style={styles.name}>{product.name || 'Ürün'}</Text>
          {isSellerProduct ? <Pressable
            onPress={() => router.push({pathname:'/marketplace/store/[slug]',params:{slug:product.seller_slug!}} as never)}
            style={[styles.sellerCard,{backgroundColor:palette.surfaceSecondary,borderColor:palette.border}]}
          >
            <View style={{height:44,width:44,borderRadius:11,backgroundColor:palette.surface,alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
              {product.seller_logo_url ? <Image source={{uri:absoluteMediaUrl(product.seller_logo_url)||undefined}} style={{height:'100%',width:'100%'}} contentFit="contain" /> : <Ionicons name="storefront-outline" size={24} color="#92400E"/>}
            </View>
            <View style={{flex:1}}><Text numberOfLines={1} style={{fontWeight:'800',fontSize:14,color:palette.text}}>{product.seller_name}</Text>
              <Text style={{fontSize:12,color:palette.accent,marginTop:3,fontWeight:'700'}}>Mağazayı görüntüle →</Text></View>
            <Ionicons name="chevron-forward" color={palette.textSecondary} size={20}/>
          </Pressable> : null}

          {product.description ? (
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
      <View style={[styles.bottomDock,{backgroundColor:palette.surface,borderColor:palette.border}]}>
        <Pressable accessibilityRole="button" accessibilityLabel={drawerOpen?'Sipariş ayrıntılarını kapat':'Sipariş ayrıntılarını aç'}
          onPress={()=>setDrawerOpen(open=>!open)} style={styles.dockHeader}>
          <View style={{flex:1}}>
            <Text style={[styles.dockLabel,{color:palette.textSecondary}]}>{loggedIn ? `${effectiveQuantity} koli · Toplam tutar` : 'B2B fiyatı · İşletme girişi gerekli'}</Text>
            <Text style={[styles.dockTotal,{color:palette.text}]}>{loggedIn && product.price!=null ? money(total) : 'Fiyat için giriş yapın'}</Text>
          </View>
          <Ionicons name={drawerOpen?'chevron-down':'chevron-up'} size={23} color={palette.text}/>
        </Pressable>
        {drawerOpen ? <View style={styles.dockExpanded}>
          {loggedIn ? <>
            <View style={styles.dockFacts}>
              <View style={styles.dockFact}><Text style={[styles.dockLabel,{color:palette.textSecondary}]}>Koli</Text><Text style={[styles.dockValue,{color:palette.text}]}>{effectiveQuantity}</Text></View>
              <View style={styles.dockFact}><Text style={[styles.dockLabel,{color:palette.textSecondary}]}>Koli içi</Text><Text style={[styles.dockValue,{color:palette.text}]}>{pack} adet</Text></View>
              <View style={styles.dockFact}><Text style={[styles.dockLabel,{color:palette.textSecondary}]}>Toplam adet</Text><Text style={[styles.dockValue,{color:palette.text}]}>{effectiveQuantity * pack}</Text></View>
            </View>
            <View style={styles.dockPriceRow}>
              <Text style={[styles.dockLabel,{color:palette.textSecondary}]}>Birim fiyat: {product.price == null?'—':money(product.price)} · Koli tutarı: {product.price==null?'—':money(Number(product.price)*pack)}</Text>
            </View>
            <View style={styles.dockOrderRow}>
              <View style={styles.quantityControl}>
                <Pressable style={styles.quantityButton} disabled={effectiveQuantity<=min} onPress={()=>setQuantity(Math.max(min,effectiveQuantity-1))} accessibilityLabel="Bir koli azalt">
                  <Ionicons name="remove" size={20} color={effectiveQuantity<=min?palette.muted:palette.text}/>
                </Pressable>
                <Text style={styles.quantityValue}>{effectiveQuantity}</Text>
                <Pressable style={styles.quantityButton} disabled={effectiveQuantity>=maxBoxes} onPress={()=>setQuantity(Math.min(maxBoxes,effectiveQuantity+1))} accessibilityLabel="Bir koli artır">
                  <Ionicons name="add" size={20} color={effectiveQuantity>=maxBoxes?palette.muted:palette.text}/>
                </Pressable>
              </View>
              <Pressable style={[styles.drawerCartButton,(adding||maxBoxes<min)&&styles.disabledButton]}
                disabled={adding||maxBoxes<min}
                onPress={async()=>{
                  if(adding)return;
                  setAdding(true);
                  try{
                    if(isSellerProduct){
                      await rmaApi.addMarketplaceCart(Number(product.marketplace_product_id),effectiveQuantity);
                      appAlert('Sepete eklendi',product.name+' · '+effectiveQuantity+' koli eklendi.',undefined,'success');
                      router.push('/marketplace/cart' as never);
                    }else{
                      await addToOrderList({
                        productId:String(product.id),sku:String(product.sku||''),name:product.name||'Ürün',
                        image,unitPrice:Number(product.price||0),unitsPerBox:pack,boxQuantity:effectiveQuantity,
                        minOrderQty:min,stock,
                      });
                      appAlert('Siparişlere eklendi',product.name+' · '+effectiveQuantity+' koli listeye eklendi.',undefined,'success');
                    }
                  }catch(e){appAlert('Ürün eklenemedi',e instanceof Error?e.message:'Tekrar deneyin.');}
                  finally{setAdding(false);}
                }}>
                <Ionicons name="cart-outline" size={19} color="#111827"/>
                <Text style={styles.drawerCartText}>{adding?'Ekleniyor…':isSellerProduct?'Sepete Ekle':'Siparişlere Ekle'}</Text>
              </Pressable>
            </View>
            {maxBoxes<min ? <Text style={styles.stockWarning}>Minimum koli için yeterli stok bulunmuyor.</Text>:null}
          </> : <Pressable style={styles.primaryButton} onPress={()=>router.push('/login')}>
            <Ionicons name="log-in-outline" size={18} color="#FFFFFF"/>
            <Text style={styles.primaryButtonText}>İşletme Hesabıyla Giriş Yap</Text>
          </Pressable>}
        </View>:null}
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
  bottomDock:{borderTopWidth:1,paddingHorizontal:spacing.lg,paddingTop:8,paddingBottom:7},
  dockHeader:{minHeight:57,flexDirection:'row',alignItems:'center',gap:10},
  dockLabel:{fontSize:12,fontWeight:'600'},
  dockTotal:{fontSize:20,fontWeight:'900',marginTop:2},
  dockExpanded:{paddingTop:11,paddingBottom:4,borderTopWidth:1,borderColor:palette.border,gap:12},
  dockFacts:{flexDirection:'row',gap:7},
  dockFact:{flex:1,padding:9,backgroundColor:palette.surfaceSecondary,borderRadius:10},
  dockValue:{fontSize:13,fontWeight:'800',marginTop:5},
  dockPriceRow:{paddingVertical:2},
  dockOrderRow:{flexDirection:'row',alignItems:'center',gap:10},
  drawerCartButton:{flex:1,minHeight:48,backgroundColor:'#FFCD00',borderRadius:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:8},
  drawerCartText:{fontWeight:'900',fontSize:13,color:'#111827'},

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
