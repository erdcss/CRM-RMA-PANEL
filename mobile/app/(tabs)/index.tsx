import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  useWindowDimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { BarcodeScannerModal } from '@/components/packages/BarcodeScannerModal';
import { appAlert } from '@/lib/appAlert';

import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { radius, spacing, typography } from '@/constants/theme';
import {
  absoluteMediaUrl,
  homepageMediaUrl,
  rmaApi,
  type B2BHomepage,
  type B2BProduct,
  type B2BReel,
  type HomeBanner,
  type HomeCategoryCard,
} from '@/lib/api';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { asCatalogProduct, productParams } from '@/lib/marketplace-products';

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
  const { width: screenWidth } = useWindowDimensions();
  const { session } = useAuth();
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  const [welcome, setWelcome] = useState(false);
  const welcomeFade = useRef(new Animated.Value(0)).current;
  const welcomeShift = useRef(new Animated.Value(-24)).current;

  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [reels, setReels] = useState<B2BReel[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryCards, setCategoryCards] = useState<HomeCategoryCard[]>([]);
  const [ledgerTileImageId, setLedgerTileImageId] = useState('');
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [failedBannerIds, setFailedBannerIds] = useState<string[]>([]);
  const [sliderAutoPlay, setSliderAutoPlay] = useState(true);
  const [sliderIntervalMs, setSliderIntervalMs] = useState(5000);
  const bannerWidth = screenWidth;
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerScrollRef = useRef<ScrollView>(null);
  const newProductsScrollRef = useRef<ScrollView>(null);
  const newProductsIndexRef = useRef(0);
  const [newProductsWidth, setNewProductsWidth] = useState(0);
  const bannerIndexRef = useRef(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const scanLockedRef = useRef(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest'|'name'|'priceAsc'|'priceDesc'>('newest');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    let valid = true;
    const key = 'caliskan_b2b_welcome_' + session.user.id;
    void AsyncStorage.getItem(key).then(value => {
      if (!valid || value) return;
      setWelcome(true);
      void AsyncStorage.setItem(key, '1');
      Animated.parallel([
        Animated.timing(welcomeFade, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(welcomeShift, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();
    }).catch(() => undefined);
    return () => { valid = false; };
  }, [session?.user?.id, welcomeFade, welcomeShift]);

  useEffect(() => {
    if (!welcome) return;
    const timer = setTimeout(() => {
      Animated.timing(welcomeFade, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => setWelcome(false));
    }, 3400);
    return () => clearTimeout(timer);
  }, [welcome, welcomeFade]);

  const applyHomepage = useCallback((homepage: B2BHomepage) => {
    setCategories(homepage.categories || []);
    setCategoryCards(homepage.categoryCards || []);
    setLedgerTileImageId(homepage.ledgerTileImageId || '');
    setBanners(homepage.banners || []);
    setSliderAutoPlay(homepage.sliderAutoPlay !== false);
    setSliderIntervalMs(homepage.sliderIntervalMs || 5000);
  }, []);

  const load = useCallback(async (forceRefresh = false) => {
    const [productResult, supplierResult, homepageResult] = await Promise.allSettled([
      rmaApi.listB2BProducts(forceRefresh),
      rmaApi.listMarketplaceProducts(),
      rmaApi.getB2BHomepage(),
    ]);

    if (productResult.status === 'fulfilled' || supplierResult.status === 'fulfilled') {
      const own = productResult.status === 'fulfilled' && Array.isArray(productResult.value) ? productResult.value : [];
      const suppliers = supplierResult.status === 'fulfilled' && Array.isArray(supplierResult.value)
        ? supplierResult.value.map(asCatalogProduct) : [];
      setProducts([...suppliers, ...own]);
      setCatalogError('');
    } else {
      setCatalogError('Ürün kataloglarına ulaşılamadı. Yeniden deneyin.');
    }

    if (homepageResult.status === 'fulfilled') {
      applyHomepage(homepageResult.value);
    }
  }, [applyHomepage]);

  useEffect(() => {
    void load();
  }, [load, session?.access_token]);

  useFocusEffect(useCallback(() => {
    // Returning from Admin-managed promotions should refresh banners without
    // requiring the customer to close or reinstall the mobile application.
    // Refresh both the catalog and category metadata when returning from a product.
    void load(true);
    void rmaApi.listB2BReels()
      .then(items => {
        setReels(Array.isArray(items) ? items.slice(0, 8) : []);
      })
      .catch(error => console.warn('Reels list fetch failed:', error));
    let mounted=true;
    if (!session?.user?.id) {setUnreadNotifications(0);return () => { mounted=false; }; }
    void rmaApi.listB2BNotifications().then(rows => {
      if (mounted) setUnreadNotifications(rows.filter(row => !row.read_at).length);
    }).catch(() => undefined);
    return () => { mounted=false; };
  }, [session?.user?.id, load]));

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('tr-TR');
    const found = search ? products.filter(product =>
      [product.name, product.sku, product.barcode, product.collection_name, product.category, product.seller_name, ...(product.tags || [])]
        .filter(Boolean)
        .some(value => String(value).toLocaleLowerCase('tr-TR').includes(search)),
    ) : [...products];
    if(sort==='name')found.sort((a,b)=>a.name.localeCompare(b.name,'tr-TR'));
    else if(sort==='priceAsc'||sort==='priceDesc')found.sort((a,b)=>{
      const aPrice=a.price==null?Infinity:Number(a.price);
      const bPrice=b.price==null?Infinity:Number(b.price);
      if(!Number.isFinite(aPrice))return Number.isFinite(bPrice)?1:0;
      if(!Number.isFinite(bPrice))return -1;
      return sort==='priceAsc'?aPrice-bPrice:bPrice-aPrice;
    });
    return found;
  }, [products, query, sort]);

  useEffect(() => {
    bannerIndexRef.current = 0;
    setBannerIndex(0);
  }, [banners.length]);

  useEffect(() => {
    if (!sliderAutoPlay || banners.length < 2 || bannerWidth <= 0 || query.trim()) return;
    const timer = setInterval(() => {
      const next = (bannerIndexRef.current + 1) % banners.length;
      bannerIndexRef.current = next;
      setBannerIndex(next);
      bannerScrollRef.current?.scrollTo({ x: next * bannerWidth, animated: true });
    }, Math.min(15000, Math.max(2500, sliderIntervalMs)));
    return () => clearInterval(timer);
  }, [bannerWidth, banners.length, query, sliderAutoPlay, sliderIntervalMs]);

  useEffect(() => {
    if (query.trim() || filtered.length < 2 || !newProductsWidth) return;
    const cardWidth = Math.min(190, Math.max(145, screenWidth * 0.42)) + spacing.sm;
    const count = Math.min(filtered.length, 10);
    const timer = setInterval(() => {
      const next = (newProductsIndexRef.current + 1) % count;
      newProductsIndexRef.current = next;
      newProductsScrollRef.current?.scrollTo({ x: next * cardWidth, animated: next !== 0 });
    }, 3500);
    return () => clearInterval(timer);
  }, [filtered.length, newProductsWidth, query, screenWidth]);

  const handleScannedBarcode = async (value: string) => {
    if (scanLockedRef.current) return;
    scanLockedRef.current = true;
    setScannerOpen(false);
    try {
      const product = await rmaApi.findB2BProductByBarcode(value);
      router.push({
        pathname: '/product/[id]',
        params: {id:String(product.id), ...(product.seller_slug ? {slug:product.seller_slug} : {})},
      } as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Barkod sorgulanamadı';
      appAlert(
        /bulunamad|404/i.test(message) ? 'Ürün bulunamadı' : 'Barkod sorgulama hatası',
        /bulunamad|404/i.test(message) ? 'Okutulan barkodla eşleşen kayıtlı ürün bulunamadı.' : message,
        undefined,
        'error',
      );
    } finally {
      setTimeout(() => { scanLockedRef.current = false; }, 1000);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen style={{ backgroundColor: palette.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.text}
          />
        }
        contentContainerStyle={styles.page}
      >
        {welcome ? <Animated.View pointerEvents="none" style={[styles.welcomeToast, { opacity: welcomeFade, transform: [{ translateY: welcomeShift }] }]}>
          <Ionicons name="checkmark-circle" size={20} color="#FFCD00" />
          <Text style={styles.welcomeText}>Çalışkan'a hoş geldiniz</Text>
        </Animated.View> : null}

        <View style={styles.headerRow}>
  <View style={[styles.searchBox, styles.headerSearchBox]}>
            <Ionicons name="search-outline" size={20} color={palette.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Ürün veya stok kodu ara"
              placeholderTextColor={palette.muted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} accessibilityLabel="Aramayı temizle">
                <Ionicons name="close-circle" size={19} color={palette.muted} />
              </Pressable>
            ) : null}
            <Pressable onPress={() => setScannerOpen(true)} style={styles.scanButton}
              accessibilityRole="button" accessibilityLabel="Barkod oku">
              <Ionicons name="scan-outline" size={23} color={palette.text} />
            </Pressable>
          </View>
  
          <Pressable
            style={styles.notificationButton}
            onPress={() => router.push('/notifications' as never)}
            accessibilityRole="button"
            accessibilityLabel="Bildirimleri aç"
          >
            <Ionicons name="notifications-outline" size={23} color={palette.text} />
            {unreadNotifications > 0 ? <View style={styles.notificationDot} /> : null}
          </Pressable>
        </View>

        {query.trim() ? (
          <View style={styles.searchResults}>
            <Text style={styles.searchResultHeading}>Arama Sonuçları · {filtered.length} ürün</Text>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:12}}>
              {([{id:'newest',label:'Yeni'},{id:'name',label:'A-Z'},{id:'priceAsc',label:'Fiyat ↑'},{id:'priceDesc',label:'Fiyat ↓'}] as const).map(item=><Pressable key={item.id} onPress={()=>setSort(item.id)}
                style={{paddingHorizontal:10,paddingVertical:7,borderRadius:8,backgroundColor:sort===item.id?'#FFCD00':palette.surfaceSecondary}}>
                <Text style={{fontWeight:'800',fontSize:11,color:sort===item.id?'#111827':palette.text}}>{item.label}</Text>
              </Pressable>)}
            </View>
            {filtered.slice(0, 50).map((product) => {
              const picture = productImage(product);
              return <Pressable key={String(product.id)} style={styles.searchResultRow}
                onPress={() => router.push({ pathname: '/product/[id]', params: productParams(product) } as never)}>
                <View style={styles.searchResultThumb}>
                  {picture ? <Image source={{ uri: picture }} style={styles.searchResultImage} contentFit="contain" /> :
                    <Ionicons name="cube-outline" size={27} color={palette.muted} />}
                </View>
                <View style={styles.searchResultBody}>
                  <Text numberOfLines={2} style={styles.searchResultTitle}>{product.name}</Text>
                  <Text style={styles.searchResultSku} numberOfLines={1}>{product.sku || product.barcode || 'Ürün'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.muted} />
              </Pressable>;
            })}
            {!filtered.length ? <Text style={styles.searchResultEmpty}>Aramanızla eşleşen ürün bulunamadı.</Text> : null}
          </View>
        ) : (
          <>

        {banners.length > 0 ? (
          <>
            <View
              style={[styles.carouselContainer, { width: bannerWidth, height: bannerWidth * 3 / 10 }]}
            >
              {bannerWidth > 0 ? (
                <ScrollView
                  ref={bannerScrollRef}
                  horizontal
                  style={{ width: bannerWidth, height: bannerWidth * 3 / 10 }}
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={100}
                  onMomentumScrollEnd={(event) => {
                    const next = Math.round(event.nativeEvent.contentOffset.x / bannerWidth);
                    bannerIndexRef.current = next;
                    setBannerIndex(next);
                  }}
                >
                  {banners.map((banner) => (
                    <View key={banner.id} style={[styles.carouselSlide, { width: bannerWidth }]}>
                      {homepageMediaUrl(banner.imageId) ? (
                        <Image
                          source={{ uri: homepageMediaUrl(banner.imageId)! }}
                          style={styles.carouselImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={180}
                          onError={() => setFailedBannerIds(ids => ids.includes(banner.id) ? ids : [...ids, banner.id])}
                          onLoad={() => setFailedBannerIds(ids => ids.filter(id => id !== banner.id))}
                        />
                      ) : null}
                      {failedBannerIds.includes(banner.id) ? (
                        <View style={styles.bannerError} pointerEvents="none">
                          <Ionicons name="image-outline" size={20} color="#FFFFFF" />
                          <Text style={styles.bannerErrorText}>Banner görseli yüklenemedi</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              ) : null}
              {banners.length > 1 ? (
                <View style={styles.carouselDots} pointerEvents="none">
                  {banners.map((banner, index) => (
                    <View
                      key={banner.id}
                      style={[styles.carouselDot, index === bannerIndex && styles.carouselDotActive]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
            {(banners[bannerIndex]?.title?.trim() ||
              banners[bannerIndex]?.subtitle?.trim() ||
              banners[bannerIndex]?.buttonText?.trim()) ? (
              <View style={styles.bannerDetails}>
                {banners[bannerIndex]?.title?.trim() ? (
                  <Text style={styles.carouselTitle} numberOfLines={2}>
                    {banners[bannerIndex].title}
                  </Text>
                ) : null}
                {banners[bannerIndex]?.subtitle?.trim() ? (
                  <Text style={styles.carouselSubtitle} numberOfLines={3}>
                    {banners[bannerIndex].subtitle}
                  </Text>
                ) : null}
                {banners[bannerIndex]?.buttonText?.trim() ? (
                  <Pressable style={styles.carouselButton} onPress={() => router.push('/(tabs)/menu')}>
                    <Text style={styles.carouselButtonText}>{banners[bannerIndex].buttonText}</Text>
                    <Ionicons name="arrow-forward" size={15} color="#131313" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Kategoriler</Text>
            <Text style={styles.sectionSubtitle}>Ürün grubunu seçin</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/products')}>
            <Text style={styles.sectionAction}>Tümü</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          <Pressable
            onPress={() => router.push('/ledger' as never)}
            style={[styles.categoryCard, styles.ledgerTile]}
            accessibilityRole="button"
            accessibilityLabel="Defterim'e git"
          >
            {ledgerTileImageId ? <Image
              source={{uri:homepageMediaUrl(ledgerTileImageId)||''}}
              style={styles.categoryImage}
              contentFit="contain"
              cachePolicy="memory-disk"
            /> : <Ionicons name="book-outline" size={27} color={palette.text}/>}
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.categoryText}>Defterim</Text>
          </Pressable>

          {categories.map((category, index) => {
            const configured = categoryCards.find((item) => item.category === category);
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
                onPress={() => router.push({ pathname: '/collection/[category]', params: { category } } as never)}
                style={styles.categoryCard}
              >
                {configured?.imageId ? (
                  <Image source={{ uri: homepageMediaUrl(configured.imageId) || '' }}
                    style={styles.categoryImage} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <Ionicons name={icons[index % icons.length]} size={28}
                    color={palette.text} />
                )}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.68}
                  style={styles.categoryText}
                >
                  {configured?.label || category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {reels.length > 0 ? <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reels Videoları</Text>
            <Pressable onPress={() => router.push('/(tabs)/discover')} accessibilityRole="button">
              <Text style={styles.sectionAction}>Tümünü Gör  →</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {reels.slice(0, 4).map(reel => (
              <Pressable
                key={String(reel.id)}
                style={styles.reelPreviewCard}
                onPress={() => router.push('/(tabs)/discover')}
                accessibilityLabel={reel.title || 'Reels videosu'}
              >
                {absoluteMediaUrl(reel.video_url) ? (
                  <Video
                    source={{ uri: absoluteMediaUrl(reel.video_url)! }}
                    style={styles.reelCoverImage}
                    resizeMode={ResizeMode.COVER}
                    isMuted
                    shouldPlay
                    isLooping
                    useNativeControls={false}
                    progressUpdateIntervalMillis={1000}
                  />
                ) : (
                  <View style={styles.reelFallback} pointerEvents="none">
                    <Ionicons name="videocam-outline" size={36} color="#CBD5E1" />
                  </View>
                )}
                <View style={styles.reelPreviewOverlay}>
                  <Ionicons name="play-circle" size={34} color="#FFCD00" />
                  <Text style={styles.reelPreviewText} numberOfLines={2}>{reel.title || 'Ürün videosu'}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </> : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Yeni Gelen Ürünler</Text>
            <Text style={styles.sectionSubtitle}>
              Çalışkan B2B ve onaylı tedarikçilerden son eklenenler
            </Text>
          </View>
          <Text style={styles.productCount}>{filtered.length} ürün</Text>
        </View>

        <ScrollView
          ref={newProductsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={event => setNewProductsWidth(event.nativeEvent.layout.width)}
          contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
        >
          {filtered.slice(0, 10).map((product) => {
            const image = productImage(product);
            const priceVisible =
              Boolean(session) &&
              product.price !== null &&
              product.price !== undefined;

            return (
              <Pressable
                key={String(product.id)}
                style={[styles.productCard, { width: Math.min(190, Math.max(145, screenWidth * 0.42)) }]}
                onPress={() =>
                  router.push({
                    pathname: '/product/[id]',
                    params: productParams(product),
                  } as never)
                }
              >
                <View style={styles.productImageWrap}>
                  {image ? (
                    <Image
                      source={{ uri: image }}
                      style={styles.productImage}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Ionicons
                      name="cube-outline"
                      size={38}
                      color={palette.muted}
                    />
                  )}
                </View>

                <View style={styles.productBody}>
                  <Text style={styles.sku}>{product.sku || 'STOK'}</Text>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  {product.seller_name ? <Text style={styles.meta} numberOfLines={1}>{product.seller_name}</Text> : null}

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
                        color={palette.textSecondary}
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
        </ScrollView>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={36} color={palette.muted} />
            <Text style={styles.emptyTitle}>Ürün bulunamadı</Text>
            <Text style={styles.emptyText}>
              {catalogError || (query.trim() ? 'Başka bir arama yapın.' : 'Katalog henüz boş veya ürünler yüklenemedi.')}
            </Text>
            <Pressable onPress={() => void load(true)} style={styles.catalogRetry}>
              <Text style={styles.catalogRetryText}>Ürünleri yeniden yükle</Text>
            </Pressable>
          </View>
        ) : null}

          </>
        )}
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
      <BarcodeScannerModal visible={scannerOpen} title="Ürün Barkodu Oku" scanMode="lookup"
        hint="Ürün barkodunu okutun. Eşleşme varsa ürün sayfasına yönlendirilirsiniz."
        onClose={() => setScannerOpen(false)}
        onScanned={(value) => void handleScannedBarcode(value)}
        onScanRejected={(message) => appAlert('Barkod okunamadı', message, undefined, 'error')}
      />
    </Screen>
  );
}

const buildStyles = (palette: AppPalette) => StyleSheet.create({
  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
    position: 'relative',
  },
  welcomeToast: { position:'absolute', right:16, top:7, zIndex:80, flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#202225', borderColor:'#FFCD00', borderWidth:1, borderRadius:13, paddingHorizontal:13, paddingVertical:11, elevation:12 },
  welcomeText: { color:'#FFFFFF', fontWeight:'800', fontSize:12 },
  reelPreviewCard:{ width:128,height:170,borderRadius:13,overflow:'hidden',backgroundColor:'#23262A',borderWidth:1,borderColor:'#41454A' },
  reelCoverImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  reelFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E293B' },
  reelPreviewOverlay:{ flex:1,justifyContent:'space-between',padding:12,backgroundColor:'rgba(0,0,0,0.4)' },
  reelPreviewText:{ color:'#FFFFFF',fontSize:12,fontWeight:'800' },
  scanButton: { width: 44, height: 46, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: palette.border, marginLeft: 2 },
  searchResults: { gap: 8, marginTop: 15 },
  searchResultHeading: { color: palette.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  searchResultRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 8 },
  searchResultThumb: { width: 56, height: 56, backgroundColor: '#FFFFFF', borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  searchResultImage: { width: '100%', height: '100%' },
  searchResultBody: { flex: 1, minWidth: 0 },
  searchResultTitle: { color: palette.text, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  searchResultSku: { color: palette.textSecondary, fontSize: 11, marginTop: 5 },
  searchResultEmpty: { color: palette.textSecondary, fontSize: 14, padding: 15, textAlign: 'center' },
  carouselContainer: { marginTop: 15, alignSelf: 'center', width: '100%', aspectRatio: 10 / 3, marginHorizontal: -spacing.lg, borderRadius: 0, overflow: 'hidden', backgroundColor: '#202124' },
  carouselImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerError: { position: 'absolute', top: 15, right: 15, flexDirection: 'row', gap: 6, alignItems: 'center', padding: 7, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.58)' },
  bannerErrorText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  carouselSlide: { aspectRatio: 10 / 3, overflow: 'hidden' },
  bannerDetails: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  carouselTitle: { color: palette.text, fontSize: 17, lineHeight: 23, fontWeight: '800' },
  carouselSubtitle: { color: palette.textSecondary, fontSize: 13, marginTop: 5, lineHeight: 19 },
  carouselButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, alignSelf: 'flex-start', borderRadius: 9, backgroundColor: '#FFCD00', minHeight: 36, paddingHorizontal: 13 },
  carouselButtonText: { color: '#101010', fontSize: 12, fontWeight: '800' },
  carouselDots: { position: 'absolute', right: 15, bottom: 9, flexDirection: 'row', gap: 6 },
  carouselDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  carouselDotActive: { width: 19, backgroundColor: '#FFCD00' },
  categoryImage: { width: 49, height: 48, borderRadius: 7 },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
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
    borderColor: palette.surface,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  headerSearchBox: { flex: 1, marginTop: 0, minWidth: 0 },
  searchBox: {
    marginTop: spacing.md,
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: palette.text,
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
    color: palette.text,
    fontWeight: '800',
  },
  sectionSubtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  sectionAction: {
    ...typography.bodyMedium,
    color: palette.text,
    fontWeight: '700',
  },
  productCount: {
    ...typography.caption,
    color: palette.muted,
  },
  categories: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  categoryCard: {
    width: 98,
    height: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 3,
    paddingVertical: spacing.xs,
  },
  ledgerTile: { borderColor: '#EAB308', borderWidth: 1.5 },
  categoryCardActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  categoryText: {
    ...typography.caption,
    fontSize: 11,
    width: '100%',
    flexShrink: 1,
    color: palette.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  catalogRetry: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: '#FACC15', borderRadius: radius.md },
  catalogRetryText: { color: '#111827', fontWeight: '800' },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  productCard: {
    width: '48%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
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
    color: palette.muted,
  },
  productName: {
    ...typography.bodyMedium,
    color: palette.text,
    minHeight: 42,
    marginTop: 3,
    fontWeight: '700',
  },
  price: {
    ...typography.subtitle,
    color: palette.text,
    marginTop: spacing.sm,
    fontWeight: '800',
  },
  lockedPrice: {
    marginTop: spacing.sm,
    minHeight: 34,
    borderRadius: radius.sm,
    backgroundColor: palette.surfaceSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  lockedPriceText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  meta: {
    ...typography.caption,
    color: palette.muted,
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
    color: palette.text,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.caption,
    color: palette.textSecondary,
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
