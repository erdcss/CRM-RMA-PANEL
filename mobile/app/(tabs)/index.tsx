import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Linking,
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
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarcodeScannerModal } from '@/components/packages/BarcodeScannerModal';
import { appAlert } from '@/lib/appAlert';
import {trackTikTokProductSearch} from '@/lib/tiktok-commerce-events';

import { useAuth } from '@/contexts/AuthContext';
import { radius, spacing, typography } from '@/constants/theme';
import {
  absoluteMediaUrl,
  homepageMediaUrl,
  rmaApi,
  type B2BHomepage,
  type B2BProduct,
  type B2BTimedCampaign,
  type B2BReel,
  type HomeBanner,
  type HomeCategoryCard,
  type RoundBottomBanner,
  type HomeSection,
} from '@/lib/api';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { asCatalogProduct, productParams } from '@/lib/marketplace-products';
import {bannerDestination,bannerDisplayHeight} from '@/lib/home-banner';
import {splitHomepageProducts,nextHomepageArrivalExpiry} from '@/lib/home-arrivals';
import { ManagedHomeSections, DEFAULT_MOBILE_HOME_SECTIONS } from '@/components/home/ManagedHomeSections';
import { TimedCampaignNotice } from '@/components/products/TimedCampaignNotice';
import { useMobileBranding, refreshMobileBranding } from '@/lib/branding';
import { getOrderList, subscribeOrderList } from '@/lib/b2b-order-list';

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
        : null) || product.image_url || null;

  return absoluteMediaUrl(raw);
}

// In live text mode, emphasize the final two words as in the Çalışkan B2B
// reference: white bold italic lead + gold bold italic ending and gold swoosh.
function sloganSegments(value:string){
  const words=value.trim().split(/\s+/).filter(Boolean);
  if(words.length<=2)return {intro:'',accent:words.join(' ')};
  return {intro:words.slice(0,-2).join(' '),accent:words.slice(-2).join(' ')};
}

export default function HomeScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { palette } = useAppearance();
  const branding = useMobileBranding();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  const [welcome, setWelcome] = useState(false);
  const welcomeFade = useRef(new Animated.Value(0)).current;
  const welcomeShift = useRef(new Animated.Value(-24)).current;

  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [timedCampaigns,setTimedCampaigns] = useState<B2BTimedCampaign[]>([]);
  const [homeSections,setHomeSections] = useState<HomeSection[]>(DEFAULT_MOBILE_HOME_SECTIONS);
  const [homeHeader,setHomeHeader] = useState({enabled:true,tagline:'Toptan alışverişin akıllı yolu'});
  const currentTagline = branding.b2b_mobile_header_tagline ?? homeHeader.tagline;
  const taglineSegments = sloganSegments(currentTagline);
  const showTaglineArtwork = branding.b2b_mobile_header_tagline_mode === 'image'
    && Boolean(branding.b2b_mobile_header_tagline_image);
  const [bestSellerProductIds,setBestSellerProductIds] = useState<string[]>([]);
  const [catalogNow, setCatalogNow] = useState(() => Date.now());
  const [newArrivalsVisible, setNewArrivalsVisible] = useState(12);
  const [catalogError, setCatalogError] = useState('');
  const [reels, setReels] = useState<B2BReel[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryCards, setCategoryCards] = useState<HomeCategoryCard[]>([]);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [roundBottomBanner,setRoundBottomBanner]=useState<RoundBottomBanner|undefined>();
  const [failedBannerIds, setFailedBannerIds] = useState<string[]>([]);
  const [sliderAutoPlay, setSliderAutoPlay] = useState(true);
  const [sliderIntervalMs, setSliderIntervalMs] = useState(5000);
  // Inset the carousel symmetrically inside the 16px page gutters.
  // Page content already has paddingHorizontal: spacing.lg.
  const bannerWidth = Math.max(1, screenWidth - spacing.lg * 2);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [loadedBannerSizes,setLoadedBannerSizes]=useState<Record<string,{width:number;height:number}>>({});
  const bannerScrollRef = useRef<ScrollView>(null);
  const homeScrollRef = useRef<ScrollView>(null);
  const wholesaleScrollRef = useRef<ScrollView>(null);
  const wholesaleIndexRef = useRef(0);
  const [wholesaleWidth, setWholesaleWidth] = useState(0);
  const bannerIndexRef = useRef(0);
  const activeBanner=banners[bannerIndex];
  const activeSize=activeBanner ? (loadedBannerSizes[activeBanner.imageId] ||
    (activeBanner.imageWidth && activeBanner.imageHeight
      ? {width:activeBanner.imageWidth,height:activeBanner.imageHeight} : null)) : null;
  const bannerHeight=bannerDisplayHeight(
    bannerWidth,activeSize?.width,activeSize?.height
  );
  const onBannerPress=useCallback((banner:HomeBanner)=>{
    const destination=bannerDestination(banner);
    if(!destination)return;
    if(destination.kind==='product'){
      router.push({pathname:'/product/[id]',params:{id:destination.id}} as never);
    }else if(destination.kind==='page'){
      router.push(destination.path as never);
    }else{
      void Linking.openURL(destination.url).catch(
        ()=>appAlert('Bağlantı açılamadı','Lütfen bağlantıyı tekrar deneyin.')
      );
    }
  },[router]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const scanLockedRef = useRef(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest'|'name'|'priceAsc'|'priceDesc'>('newest');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getOrderList().then(items => {
        if (active) setCartCount(items.length);
      }).catch(() => undefined);
    };
    refresh();
    const unsubscribe = subscribeOrderList(refresh);
    return () => { active = false; unsubscribe(); };
  }, []);
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
    setBanners(homepage.banners || []);
    setRoundBottomBanner(homepage.roundBottomBanner);
    setSliderAutoPlay(homepage.sliderAutoPlay !== false);
    setSliderIntervalMs(homepage.sliderIntervalMs || 5000);
    setHomeSections(homepage.homeSections || DEFAULT_MOBILE_HOME_SECTIONS);
    setHomeHeader(homepage.homeHeader || {enabled:true,tagline:'Toptan alışverişin akıllı yolu'});
    setBestSellerProductIds(homepage.bestSellerProductIds || []);
  }, []);

  const load = useCallback(async (forceRefresh = false) => {
    const [productResult, supplierResult, homepageResult, campaignResult] = await Promise.allSettled([
      rmaApi.listB2BProducts(forceRefresh),
      rmaApi.listMarketplaceProducts(),
      rmaApi.getB2BHomepage(),
      rmaApi.listTimedCampaigns(),
    ]);

    if (productResult.status === 'fulfilled' || supplierResult.status === 'fulfilled') {
      const own = productResult.status === 'fulfilled' && Array.isArray(productResult.value) ? productResult.value : [];
      const suppliers = supplierResult.status === 'fulfilled' && Array.isArray(supplierResult.value)
        ? supplierResult.value.map(asCatalogProduct) : [];
      setProducts([...suppliers, ...own]);
      setCatalogNow(Date.now());
      setCatalogError('');
    } else {
      setCatalogError('Ürün kataloglarına ulaşılamadı. Yeniden deneyin.');
    }

    if (homepageResult.status === 'fulfilled') {
      applyHomepage(homepageResult.value);
    }
    if (campaignResult.status === 'fulfilled') {
      setTimedCampaigns(Array.isArray(campaignResult.value) ? campaignResult.value : []);
    }
  }, [applyHomepage]);

  useEffect(() => {
    void load();
  }, [load, session?.access_token]);

  useFocusEffect(useCallback(() => {
    setCatalogNow(Date.now());
    // Returning from Admin-managed promotions should refresh banners without
    // requiring the customer to close or reinstall the mobile application.
    // Refresh both the catalog and category metadata when returning from a product.
    void load(true);
    void refreshMobileBranding();
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
      [product.name, product.sku, product.barcode, product.collection_name, product.category, product.brand, product.seller_name, ...(product.tags || [])]
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

  const { newArrivals, wholesale } = useMemo(
    () => splitHomepageProducts(filtered, catalogNow),
    [filtered, catalogNow],
  );

  // When a product reaches its 24-hour deadline, move it to wholesale
  // automatically, without requiring a refresh or app restart.
  useEffect(() => {
    const deadline = nextHomepageArrivalExpiry(products, catalogNow);
    if (deadline === null) return;
    const timeout = setTimeout(
      () => setCatalogNow(Date.now()),
      Math.max(1, Math.min(2_147_483_647, deadline - Date.now() + 1)),
    );
    return () => clearTimeout(timeout);
  }, [products, catalogNow]);

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
    if (query.trim() || wholesale.length < 2 || !wholesaleWidth) return;
    const cardWidth = Math.min(190, Math.max(145, screenWidth * 0.42)) + spacing.sm;
    const count = Math.min(wholesale.length, 10);
    const timer = setInterval(() => {
      const next = (wholesaleIndexRef.current + 1) % count;
      wholesaleIndexRef.current = next;
      wholesaleScrollRef.current?.scrollTo({ x: next * cardWidth, animated: next !== 0 });
    }, 3500);
    return () => clearInterval(timer);
  }, [wholesale.length, wholesaleWidth, query, screenWidth]);

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

  const renderHomeProductCard = (product: B2BProduct, isNewArrivalCard = false) => {

            const image = productImage(product);
            const pack = Math.max(1, Number(product.units_per_box) || 1);
            const minBoxes = Math.max(1, Number(product.min_order_qty) || 1);
            const stock = Math.max(0, Number(product.stock) || 0);
            const soldOut = stock === 0;
            const cannotOrder = stock < pack * minBoxes;
            const priceVisible =
              Boolean(session) &&
              product.price !== null &&
              product.price !== undefined;

            return (
              <Pressable
                key={String(product.id)}
                style={[styles.productCard, { width: isNewArrivalCard
                  ? Math.max(130, Math.floor((screenWidth - 2 * spacing.lg - spacing.sm) / 2))
                  : Math.min(190, Math.max(145, screenWidth * 0.42)) }, cannotOrder && styles.unavailableProductCard]}
                onPress={() =>
                  router.push({
                    pathname: '/product/[id]',
                    params: productParams(product),
                  } as never)
                }
              >
                <View style={styles.productImageWrap}>
                  {isNewArrivalCard ? (
                    <View style={styles.newArrivalBadge} pointerEvents="none">
                      <Text style={styles.newArrivalBadgeText}>YENİ GELDİ</Text>
                    </View>
                  ) : null}
                  {image ? (
                    <Image
                      source={{ uri: image }}
                      style={[styles.productImage, cannotOrder && styles.unavailableProductImage]}
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
                  {cannotOrder ? (
                    <View pointerEvents="none" style={styles.stockOverlayBadge}>
                      <Ionicons name="ban-outline" size={15} color="#FFFFFF" />
                      <Text style={styles.stockOverlayText}>{soldOut ? 'STOKTA YOK' : 'STOK YETERSİZ'}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.productBody}>
                  <Text style={styles.sku}>{product.sku || 'STOK'}</Text>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  {product.seller_name ? <Text style={styles.meta} numberOfLines={1}>{product.seller_name}</Text> : null}

                  {priceVisible ? (
                    <View>
                      {product.timed_campaign_end_at&&product.original_price!=null ? (
                        <Text style={{fontSize:11,color:palette.muted,textDecorationLine:'line-through'}}>{money(product.original_price)}</Text>
                      ) : null}
                      <Text style={[styles.price, cannotOrder && styles.unavailablePrice]}>{money(product.price)}</Text>
                    </View>
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

                  {product.timed_campaign_end_at ? <TimedCampaignNotice
                    compact endAt={product.timed_campaign_end_at}
                    title={product.timed_campaign_title} stock={product.stock}
                    unitsPerBox={product.units_per_box} onExpire={()=>void load(true)}/> : null}

                  {cannotOrder ? (
                    <View style={styles.stockMessage}>
                      <Ionicons name="cube-outline" size={14} color="#BE123C"/>
                      <Text style={styles.stockMessageText}>{soldOut ? 'Stoklar tükenmiştir.' : 'Sipariş için yeterli stok yok.'}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.meta, cannotOrder && styles.unavailablePrice]}>
                    Koli içi {pack} · Min. {minBoxes}
                  </Text>
                </View>
              </Pressable>
            );

  };

  return (
    <View style={{flex:1,backgroundColor:palette.background}}>
      {isFocused ? (
        <StatusBar style={homeHeader.enabled ? 'light' : 'auto'}
          translucent backgroundColor="transparent" />
      ) : null}
      <ScrollView
        ref={homeScrollRef}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
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

        {homeHeader.enabled ? (
          <View style={[styles.homeBrandHeader,{width:screenWidth}]}>
            {branding.b2b_mobile_header_background ? (
              <Image
                source={{uri:branding.b2b_mobile_header_background}}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                cachePolicy="memory-disk"
                accessibilityLabel="Header arka planı"
              />
            ) : null}
            <View style={[styles.homeBrandHeaderContent,{paddingTop:insets.top+7}]}>
              <View style={styles.homeBrandMain}>
                <View style={styles.homeBrandLogoRow}>
                {branding.b2b_mobile_header_logo ? (
                  <Image
                    source={{uri:branding.b2b_mobile_header_logo}}
                    contentFit="contain"
                    cachePolicy="none"
                    accessibilityLabel="Çalışkan B2B logosu"
                    style={styles.homeBrandLogo}
                  />
                ) : (
                  <Text style={styles.homeBrandFallback}>
                    ÇALIŞKAN <Text style={{color:'#FFCD00'}}>B2B</Text>
                  </Text>
                )}
                </View>
                {showTaglineArtwork ? (
                  <Image
                    source={{uri:branding.b2b_mobile_header_tagline_image!}}
                    style={styles.homeBrandTaglineArtwork}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    accessibilityLabel={currentTagline || 'Çalışkan B2B sloganı'}
                  />
                ) : currentTagline.trim() ? (
                  <View style={styles.homeBrandTaglineRow}
                    accessibilityLabel={currentTagline}>
                    {taglineSegments.intro ? (
                      <Text numberOfLines={1} adjustsFontSizeToFit
                        style={styles.homeBrandTaglineIntro}>
                        {taglineSegments.intro}{' '}
                      </Text>
                    ) : null}
                    <View style={styles.homeBrandTaglineAccentWrap}>
                      <Text numberOfLines={1} adjustsFontSizeToFit
                        style={styles.homeBrandTaglineAccent}>
                        {taglineSegments.accent}
                      </Text>
                      <View pointerEvents="none" style={styles.homeBrandTaglineSwoosh}/>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={[styles.homeHeaderTopActions,{top:insets.top+7}]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bildirimleri aç"
                onPress={()=>router.push('/notifications' as never)}
                style={styles.homeHeaderIconButton}
              >
                <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
                {unreadNotifications>0?<View style={styles.homeNotificationDot}/>:null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={cartCount ? `Siparişlerim, sepette ${cartCount} ürün` : 'Siparişlerim'}
                onPress={()=>router.push('/(tabs)/orders' as never)}
                style={styles.homeHeaderIconButton}
              >
                <Ionicons name="cart-outline" size={23} color="#FFFFFF" />
                {cartCount>0?<View style={styles.homeCartCount}>
                  <Text style={styles.homeCartCountText}>{cartCount>9?'9+':cartCount}</Text>
                </View>:null}
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={[styles.homeBrowseBlock,{width:screenWidth},
          !homeHeader.enabled && {paddingTop:insets.top+spacing.sm}]}>
          <View style={styles.headerRow}>
            <View style={[styles.searchBox,styles.headerSearchBox]}>
              <Ionicons name="search-outline" size={17} color="#404650" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Ürün, marka veya barkod ara"
                placeholderTextColor="#707782"
                style={styles.searchInput}
                returnKeyType="search"
                onSubmitEditing={()=>{void trackTikTokProductSearch(query);}}
              />
              {query ? (
                <Pressable onPress={()=>setQuery('')} accessibilityLabel="Aramayı temizle">
                  <Ionicons name="close-circle" size={18} color="#6B7280" />
                </Pressable>
              ) : null}
              <Pressable onPress={()=>setScannerOpen(true)} style={styles.scanButton}
                accessibilityRole="button" accessibilityLabel="Barkod oku">
                <Ionicons name="scan-outline" size={21} color="#111827" />
              </Pressable>
            </View>
          </View>

          {!query.trim() ? (
            <View style={styles.categoryQuickRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={styles.categoryStripScroll}
                contentContainerStyle={styles.categories}>
                {categories.map((category,index)=>{
                  const configured=categoryCards.find(item=>item.category===category);
                  const icons: Array<keyof typeof Ionicons.glyphMap> = [
                    'laptop-outline','cafe-outline','home-outline','construct-outline',
                    'briefcase-outline','cube-outline','layers-outline',
                  ];
                  return (
                    <Pressable key={category}
                      accessibilityRole="button"
                      accessibilityLabel={configured?.label || category}
                      onPress={()=>router.push({
                        pathname:'/collection/[category]',params:{category},
                      } as never)}
                      style={styles.categoryCard}>
                      {configured?.imageId ? (
                        <Image source={{uri:homepageMediaUrl(configured.imageId)||''}}
                          style={styles.categoryImage} contentFit="contain" cachePolicy="memory-disk"/>
                      ) : (
                        <Ionicons name={icons[index%icons.length]} size={26} color="#FFCD00" />
                      )}
                      <Text numberOfLines={2} style={styles.categoryText}>
                        {configured?.label||category}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable style={styles.allCategoriesCard}
                accessibilityRole="button" accessibilityLabel="Tüm kategoriler"
                onPress={()=>router.push('/(tabs)/menu' as never)}>
                <Ionicons name="grid-outline" size={25} color="#FFCD00" />
                <Text numberOfLines={2} style={styles.allCategoriesText}>Tüm Kategoriler</Text>
              </Pressable>
            </View>
          ) : null}
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
              style={[styles.carouselContainer, { width: bannerWidth, height: bannerHeight }]}
            >
              {bannerWidth > 0 ? (
                <ScrollView
                  ref={bannerScrollRef}
                  horizontal
                  style={{ width: bannerWidth, height: bannerHeight }}
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
                    <Pressable key={banner.id}
                      accessible accessibilityRole="button"
                      accessibilityLabel={banner.title||'Banner'}
                      disabled={!bannerDestination(banner)}
                      onPress={()=>onBannerPress(banner)}
                      style={[styles.carouselSlide,{width:bannerWidth,height:bannerHeight}]}>
                      {homepageMediaUrl(banner.imageId) ? (
                        <Image
                          source={{ uri: homepageMediaUrl(banner.imageId)! }}
                          style={styles.carouselImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={180}
                          onError={() => setFailedBannerIds(ids => ids.includes(banner.id) ? ids : [...ids, banner.id])}
                          onLoad={(event) => {
                            setFailedBannerIds(ids => ids.filter(id => id !== banner.id));
                            const width=event.source?.width, height=event.source?.height;
                            if(width>0 && height>0)setLoadedBannerSizes(previous=>
                              previous[banner.imageId]?.width===width&&previous[banner.imageId]?.height===height
                                ? previous : {...previous,[banner.imageId]:{width,height}});
                          }}
                        />
                      ) : null}
                      {failedBannerIds.includes(banner.id) ? (
                        <View style={styles.bannerError} pointerEvents="none">
                          <Ionicons name="image-outline" size={20} color="#FFFFFF" />
                          <Text style={styles.bannerErrorText}>Banner görseli yüklenemedi</Text>
                        </View>
                      ) : null}
                    </Pressable>
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
                  <Pressable style={styles.carouselButton}
                    disabled={!bannerDestination(banners[bannerIndex])}
                    onPress={()=>onBannerPress(banners[bannerIndex])}>
                    <Text style={styles.carouselButtonText}>{banners[bannerIndex].buttonText}</Text>
                    <Ionicons name="arrow-forward" size={15} color="#131313" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        <ManagedHomeSections
          sections={homeSections}
          products={products}
          bestSellerProductIds={bestSellerProductIds}
          campaigns={timedCampaigns}
          reels={reels}
          now={catalogNow}
          signedIn={Boolean(session)}
          renderProduct={renderHomeProductCard}
          onRefresh={()=>{void load(true);}}
          onOpenScanner={()=>setScannerOpen(true)}
          onRoute={(path)=>router.push(path as never)}
          onBrand={(brand)=>{
            setQuery(brand);
            homeScrollRef.current?.scrollTo({y:0,animated:true});
          }}
        />

        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.newArrivalLabelRow}>
              <View style={styles.newArrivalDot} />
              <Text style={styles.newArrivalLabel}>SON 24 SAAT</Text>
            </View>
            <Text style={styles.sectionTitle}>Yeni Gelen Ürünler</Text>
            <Text style={styles.sectionSubtitle}>Kataloğumuza son 24 saatte eklenen ürünler</Text>
          </View>
          <Text style={styles.productCount}>{newArrivals.length} yeni ürün</Text>
        </View>

        {newArrivals.length > 0 ? (
          <>
            <View style={styles.productGrid}>
              {newArrivals.slice(0, newArrivalsVisible).map(product => renderHomeProductCard(product, true))}
            </View>
            {newArrivalsVisible < newArrivals.length ? (
              <Pressable
                onPress={() => setNewArrivalsVisible(value => value + 12)}
                style={styles.catalogRetry}
                accessibilityRole="button"
                accessibilityLabel="Daha fazla yeni gelen ürün göster"
              >
                <Text style={styles.catalogRetryText}>Daha fazla yeni ürün gör</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <View style={styles.newArrivalEmpty}>
            <Text style={styles.newArrivalEmptyText}>Son 24 saatte eklenen yeni ürün bulunmuyor.</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Toptan Ürünler</Text>
            <Text style={styles.sectionSubtitle}>Çalışkan B2B ve onaylı tedarikçi ürünleri</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/products')} accessibilityRole="button">
            <Text style={styles.sectionAction}>Tümünü Gör</Text>
          </Pressable>
        </View>
        {wholesale.length > 0 ? (
          <ScrollView
            ref={wholesaleScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onLayout={event => setWholesaleWidth(event.nativeEvent.layout.width)}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
          >
            {wholesale.slice(0, 10).map(product => renderHomeProductCard(product))}
          </ScrollView>
        ) : (
          <View style={styles.newArrivalEmpty}>
            <Text style={styles.newArrivalEmptyText}>Toptan ürünler burada listelenecek. Yeni ürünler yukarıdaki bölümde yer alır.</Text>
          </View>
        )}

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
      {roundBottomBanner?.enabled&&roundBottomBanner.imageId&&
       roundBottomBanner.productIds?.length>0&&
       (!roundBottomBanner.endAt||new Date(roundBottomBanner.endAt).getTime()>Date.now())&&
       homepageMediaUrl(roundBottomBanner.imageId) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={roundBottomBanner.buttonText||'Kampanyaları keşfet'}
          onPress={()=>router.push('/campaigns' as never)}
          style={{
            position:'absolute',right:16,
            bottom:Math.min(240,Math.max(90,Number(roundBottomBanner.bottomOffset)||112)),
            width:Math.min(128,Math.max(56,Number(roundBottomBanner.circleSize)||84)),
            height:Math.min(128,Math.max(56,Number(roundBottomBanner.circleSize)||84)),
            borderRadius:999,overflow:'hidden',
            borderWidth:3,borderColor:roundBottomBanner.accentColor||'#FFCD00',
            backgroundColor:roundBottomBanner.backgroundColor||'#0B1225',
            elevation:13,zIndex:60,
            shadowColor:'#000000',shadowOpacity:0.27,shadowRadius:12,
          }}
        >
          <Image source={{uri:homepageMediaUrl(roundBottomBanner.imageId)!}}
            style={{width:'100%',height:'100%'}} contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        </Pressable>
      ):null}
      <BarcodeScannerModal visible={scannerOpen} title="Ürün Barkodu Oku" scanMode="lookup"
        hint="Ürün barkodunu okutun. Eşleşme varsa ürün sayfasına yönlendirilirsiniz."
        onClose={() => setScannerOpen(false)}
        onScanned={(value) => void handleScannedBarcode(value)}
        onScanRejected={(message) => appAlert('Barkod okunamadı', message, undefined, 'error')}
      />
    </View>
  );
}

const buildStyles = (palette: AppPalette) => StyleSheet.create({
  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: 120,
    position: 'relative',
  },
  homeBrandHeader: {
    // Full-bleed artwork starts under the transparent iOS status bar.
    minHeight:73,
    marginLeft:-spacing.lg,
    marginTop:0,
    marginBottom:0,
    backgroundColor:'#121213',
    borderRadius:0,
    borderWidth:0,
    overflow:'hidden',
    position:'relative',
  },
  homeBrandHeaderContent: {
    minHeight:73,
    paddingHorizontal:spacing.lg,
    paddingBottom:9,
    alignItems:'center',
    justifyContent:'center',
  },
  homeBrandMain: {width:'100%',alignItems:'center',justifyContent:'center'},
  homeBrandLogoRow: {width:'64%',alignItems:'center',justifyContent:'center'},
  homeHeaderTopActions: {
    position:'absolute',right:spacing.lg,
    flexDirection:'row',alignItems:'center',gap:4,
  },
  homeHeaderIconButton: {width:35,height:44,alignItems:'center',justifyContent:'center'},
  homeNotificationDot: {
    position:'absolute',top:5,right:7,width:8,height:8,borderRadius:4,
    backgroundColor:'#FFCD00',
  },
  homeCartCount: {
    position:'absolute',top:0,right:0,minWidth:17,height:17,
    borderRadius:9,paddingHorizontal:2,alignItems:'center',justifyContent:'center',
    backgroundColor:'#FFCD00',
  },
  homeCartCountText:{fontSize:9,fontWeight:'900',color:'#111113'},
  homeBrandLogo: {width:'85%',height:38,backgroundColor:'transparent'},
  homeBrandFallback: {color:'#FFFFFF',fontSize:19,fontWeight:'900',letterSpacing:0.3},
  homeBrandTaglineArtwork:{
    width:'86%',maxWidth:340,height:54,marginTop:4,backgroundColor:'transparent',
  },
  homeBrandTaglineRow:{
    flexDirection:'row',alignItems:'center',justifyContent:'center',
    maxWidth:'90%',marginTop:4,paddingBottom:5,
  },
  homeBrandTaglineIntro:{
    color:'#FFFFFF',fontSize:15,fontWeight:'900',fontStyle:'italic',letterSpacing:-0.2,
    flexShrink:1,
  },
  homeBrandTaglineAccentWrap:{
    justifyContent:'center',alignItems:'center',maxWidth:'50%',
  },
  homeBrandTaglineAccent:{
    color:'#FFCD00',fontSize:15,fontWeight:'900',fontStyle:'italic',letterSpacing:-0.2,
  },
  homeBrandTaglineSwoosh:{
    position:'absolute',bottom:-3,width:'96%',height:2.3,borderRadius:3,
    backgroundColor:'#FFCD00',transform:[{rotate:'-4deg'}],
  },
  welcomeToast: { position:'absolute', right:16, top:7, zIndex:80, flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#202225', borderColor:'#FFCD00', borderWidth:1, borderRadius:13, paddingHorizontal:13, paddingVertical:11, elevation:12 },
  welcomeText: { color:'#FFFFFF', fontWeight:'800', fontSize:12 },
  reelPreviewCard:{ width:128,height:170,borderRadius:13,overflow:'hidden',backgroundColor:'#23262A',borderWidth:1,borderColor:'#41454A' },
  reelCoverImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  reelFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E293B' },
  reelPreviewOverlay:{ flex:1,justifyContent:'space-between',padding:12,backgroundColor:'rgba(0,0,0,0.4)' },
  reelPreviewText:{ color:'#FFFFFF',fontSize:12,fontWeight:'800' },
  scanButton: { width:36,height:36,alignItems:'center',justifyContent:'center' },
  searchResults: { gap: 8, marginTop: 15 },
  searchResultHeading: { color: palette.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  searchResultRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 8 },
  searchResultThumb: { width: 56, height: 56, backgroundColor: '#FFFFFF', borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  searchResultImage: { width: '100%', height: '100%' },
  searchResultBody: { flex: 1, minWidth: 0 },
  searchResultTitle: { color: palette.text, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  searchResultSku: { color: palette.textSecondary, fontSize: 11, marginTop: 5 },
  searchResultEmpty: { color: palette.textSecondary, fontSize: 14, padding: 15, textAlign: 'center' },
  carouselContainer: { marginTop: spacing.sm, alignSelf: 'center', borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  carouselImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerError: { position: 'absolute', top: 15, right: 15, flexDirection: 'row', gap: 6, alignItems: 'center', padding: 7, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.58)' },
  bannerErrorText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  carouselSlide: { overflow: 'hidden', backgroundColor: '#FFFFFF' },
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
  homeBrowseBlock:{
    marginLeft:-spacing.lg,
    backgroundColor:'#111113',
    paddingHorizontal:spacing.lg,
    paddingTop:5,
    paddingBottom:9,
  },
  headerRow: {flexDirection:'row',alignItems:'center',marginTop:0},
  headerSearchBox: {flex:1,marginTop:0,minWidth:0},
  searchBox: {
    minHeight:40,borderRadius:12,borderWidth:0,backgroundColor:'#FFFFFF',
    paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:7,
  },
  searchInput: {flex:1,fontSize:13,fontWeight:'500',color:'#111827',height:40,paddingVertical:0},
  categoryQuickRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:9},
  categoryStripScroll:{flex:1,minWidth:0},
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
  categories:{gap:7,paddingRight:5,paddingLeft:2,paddingVertical:4},
  categoryCard:{
    width:66,height:70,borderRadius:12,borderWidth:1,
    borderColor:'#414146',borderTopColor:'#505055',borderBottomColor:'#303034',
    backgroundColor:'#2A2A2D',
    shadowColor:'#000000',shadowOffset:{width:0,height:2},
    shadowOpacity:0.38,shadowRadius:3,elevation:3,
    alignItems:'center',justifyContent:'center',gap:3,
    paddingHorizontal:4,paddingVertical:4,
  },
  categoryImage:{width:31,height:30,borderRadius:5},
  categoryText:{
    fontSize:9,lineHeight:11,color:'#F1F1F2',
    fontWeight:'400',textAlign:'center',width:'100%',
  },
  allCategoriesCard:{
    width:67,height:70,borderRadius:12,borderWidth:1,
    borderColor:'#FFCD00',backgroundColor:'#2A2A2D',
    shadowColor:'#000000',shadowOffset:{width:0,height:2},
    shadowOpacity:0.38,shadowRadius:3,elevation:3,
    alignItems:'center',justifyContent:'center',gap:3,
    paddingHorizontal:3,paddingVertical:4,
  },
  allCategoriesText:{
    fontSize:9,lineHeight:11,color:'#F1F1F2',fontWeight:'400',textAlign:'center',
  },
  catalogRetry: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: '#FACC15', borderRadius: radius.md },
  catalogRetryText: { color: '#111827', fontWeight: '800' },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  newArrivalLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  newArrivalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A' },
  newArrivalLabel: { fontSize: 10, color: '#15803D', fontWeight: '800', letterSpacing: 0.5 },
  newArrivalBadge: {
    position: 'absolute', top: 8, left: 8, zIndex: 2,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
    backgroundColor: '#16A34A',
  },
  newArrivalBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  newArrivalEmpty: {
    borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface,
    paddingVertical: 22, paddingHorizontal: 16, borderRadius: 12,
  },
  newArrivalEmptyText: { color: palette.textSecondary, fontSize: 13, textAlign: 'center' },
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
  unavailableProductCard: { borderColor: '#E5E7EB' },
  unavailableProductImage: { opacity: 0.42 },
  stockOverlayBadge: {
    position: 'absolute', left: 7, right: 7, top: '40%',
    minHeight: 36, paddingHorizontal: 7, paddingVertical: 8, borderRadius: 22,
    backgroundColor: '#C91F2C', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#FFFFFF',
  },
  stockOverlayText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', flexShrink: 1, textAlign: 'center' },
  unavailablePrice: { color: '#9CA3AF' },
  stockMessage: {
    marginTop: 8, paddingHorizontal: 8, paddingVertical: 8,
    backgroundColor: '#FFF1F2', borderRadius: 9,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  stockMessageText: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: '700', color: '#9F1239' },
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
