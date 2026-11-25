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
import { CompactProductCard, stripProductWidth, gridProductWidth } from '@/components/products/CompactProductCard';
import { useMobileBranding, refreshMobileBranding } from '@/lib/branding';
import { getOrderList, subscribeOrderList } from '@/lib/b2b-order-list';

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
  // Keep six shortcuts and the full category menu visible without horizontal scrolling.
  const quickCategories = categories.slice(0, 6);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [roundBottomBanner,setRoundBottomBanner]=useState<RoundBottomBanner|undefined>();
  const [failedBannerIds, setFailedBannerIds] = useState<string[]>([]);
  const [sliderAutoPlay, setSliderAutoPlay] = useState(true);
  const [sliderIntervalMs, setSliderIntervalMs] = useState(5000);
  // Inset the carousel symmetrically inside the 16px page gutters.
  // Page content already has paddingHorizontal: spacing.lg.
  const bannerWidth = Math.max(1, screenWidth - spacing.lg * 2);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerScrollRef = useRef<ScrollView>(null);
  const homeScrollRef = useRef<ScrollView>(null);
  const wholesaleScrollRef = useRef<ScrollView>(null);
  const wholesaleIndexRef = useRef(0);
  const [wholesaleWidth, setWholesaleWidth] = useState(0);
  const bannerIndexRef = useRef(0);
  const bannerHeight=bannerDisplayHeight(bannerWidth);
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
  const [refreshAnimationImageId,setRefreshAnimationImageId] = useState('');
  const [refreshGifFailed,setRefreshGifFailed] = useState(false);
  const refreshPulse=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    if(!refreshing){refreshPulse.setValue(0);return;}
    const animation=Animated.loop(Animated.sequence([
      Animated.timing(refreshPulse,{toValue:1,duration:550,useNativeDriver:true}),
      Animated.timing(refreshPulse,{toValue:0,duration:550,useNativeDriver:true}),
    ]));
    animation.start();
    return ()=>animation.stop();
  },[refreshing,refreshPulse]);
  useEffect(()=>{setRefreshGifFailed(false);},[refreshAnimationImageId]);

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
    setRefreshAnimationImageId(homepage.refreshAnimationImageId || '');
    setHomeHeader(homepage.homeHeader || {enabled:true,tagline:'Toptan alışverişin akıllı yolu'});
    setBestSellerProductIds(homepage.bestSellerProductIds || []);
  }, []);

  const homepageRequestRef=useRef(0);
  const refreshHomepage=useCallback(async()=>{
    const requestId=++homepageRequestRef.current;
    const homepage=await rmaApi.getB2BHomepage();
    if(requestId===homepageRequestRef.current)applyHomepage(homepage);
  },[applyHomepage]);
  const load = useCallback(async (forceRefresh = false) => {
    const [productResult, supplierResult, , campaignResult] = await Promise.allSettled([
      rmaApi.listB2BProducts(forceRefresh),
      rmaApi.listMarketplaceProducts(),
      refreshHomepage(),
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

    if (campaignResult.status === 'fulfilled') {
      setTimedCampaigns(Array.isArray(campaignResult.value) ? campaignResult.value : []);
    }
  }, [refreshHomepage]);

  useFocusEffect(useCallback(()=>{
    const timer=setInterval(()=>{void refreshHomepage().catch(()=>undefined);},30_000);
    return ()=>clearInterval(timer);
  },[refreshHomepage]));

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
    const cardWidth = stripProductWidth(wholesaleWidth) + spacing.sm;
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

  const renderHomeProductCard = (product: B2BProduct, isNewArrivalCard = false, viewportWidth?: number) => {
    const viewport = viewportWidth || Math.max(1, screenWidth - 2 * spacing.lg);
    return <CompactProductCard key={product.marketplace ? 'marketplace-'+product.id : 'b2b-'+product.id}
      product={product} width={isNewArrivalCard?gridProductWidth(viewport):stripProductWidth(viewport)}
      signedIn={Boolean(session)} newArrival={isNewArrivalCard}
      onPress={()=>router.push({pathname:'/product/[id]',params:productParams(product)} as never)}
      onLogin={()=>router.push('/login')} onExpire={()=>void load(true)}/>;
  };

  return (
    <View style={{flex:1,backgroundColor:palette.background}}>
      {isFocused ? (
        <StatusBar style={homeHeader.enabled ? 'light' : 'auto'}
          translucent backgroundColor="transparent" />
      ) : null}
      <View style={styles.stickyHomeTop}>
        {welcome ? <Animated.View pointerEvents="none" style={[styles.welcomeToast, { opacity: welcomeFade, transform: [{ translateY: welcomeShift }] }]}>
          <Ionicons name="checkmark-circle" size={20} color="#FFCD00" />
          <Text style={styles.welcomeText}>Çalışkan'a hoş geldiniz</Text>
        </Animated.View> : null}

        {homeHeader.enabled ? (
          <View style={[styles.homeBrandHeader,{width:screenWidth,marginLeft:0}]}>
            {branding.b2b_mobile_header_background ? (
              <Image
                source={{uri:branding.b2b_mobile_header_background}}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                cachePolicy="memory-disk"
                accessibilityLabel="Header arka planı"
              />
            ) : null}
            <View style={[styles.homeBrandHeaderContent,{paddingTop:insets.top+2}]}>
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
            <View style={[styles.homeHeaderTopActions,{top:insets.top+2}]}>
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
              <Ionicons name="search-outline" size={16} color="#242426" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Ürün, marka veya barkod ara"
                placeholderTextColor="#45454A"
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
                accessibilityRole="button" accessibilityLabel="Barkod oku" hitSlop={{top:6,bottom:6,left:4,right:4}}>
                <View style={styles.scanGlyph} pointerEvents="none">
                  <View style={[styles.scanCorner,{top:0,left:0,borderTopWidth:1.8,borderLeftWidth:1.8,borderTopLeftRadius:2}]}/>
                  <View style={[styles.scanCorner,{top:0,right:0,borderTopWidth:1.8,borderRightWidth:1.8,borderTopRightRadius:2}]}/>
                  <View style={[styles.scanCorner,{bottom:0,left:0,borderBottomWidth:1.8,borderLeftWidth:1.8,borderBottomLeftRadius:2}]}/>
                  <View style={[styles.scanCorner,{bottom:0,right:0,borderBottomWidth:1.8,borderRightWidth:1.8,borderBottomRightRadius:2}]}/>
                  <View style={styles.scanBars}>
                    {[2.3,0.9,3.1,1.1,0.7,1.8,1].map((width,index)=>(
                      <View key={index} style={[styles.scanBar,{width}]}/>
                    ))}
                  </View>
                </View>
              </Pressable>
            </View>
          </View>

          {!query.trim() ? (
            <View style={styles.categoryQuickRow}>
                {quickCategories.map((category,index)=>{
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
                        <Ionicons name={icons[index%icons.length]} size={22} color="#FFCD00" />
                      )}
                      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.categoryText}>
                        {configured?.label||category}
                      </Text>
                    </Pressable>
                  );
                })}
              <Pressable style={styles.allCategoriesCard}
                accessibilityRole="button" accessibilityLabel="Tüm kategoriler"
                onPress={()=>router.push('/(tabs)/menu' as never)}>
                <Ionicons name="grid-outline" size={21} color="#FFCD00" />
                <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.allCategoriesText}>Tüm Kategoriler</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.scrollableHomeContent}>
        <ScrollView
          ref={homeScrollRef}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent"/>
          }
          contentContainerStyle={styles.page}
        >
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
                  {banners.map((banner) => {
                    const hasCopy=Boolean(banner.title?.trim()||banner.subtitle?.trim()||banner.buttonText?.trim());
                    return <Pressable key={banner.id}
                      accessible accessibilityRole="button"
                      accessibilityLabel={banner.title||'Banner'}
                      disabled={!bannerDestination(banner)}
                      onPress={()=>onBannerPress(banner)}
                      style={[styles.carouselSlide,{width:bannerWidth,height:bannerHeight}]}>
                      {homepageMediaUrl(banner.imageId) ? (
                        <>
                          {!hasCopy ? (
                            <Image source={{uri:homepageMediaUrl(banner.imageId)!}}
                              style={styles.carouselImageBackdrop} contentFit="cover"
                              cachePolicy="memory-disk" accessibilityIgnoresInvertColors/>
                          ) : null}
                          <Image
                            source={{ uri: homepageMediaUrl(banner.imageId)! }}
                            style={hasCopy?styles.carouselSideImage:styles.carouselImage}
                            // Preserve the complete text/products; the cover layer only fills unused side space.
                            contentFit={hasCopy?'cover':'contain'}
                            cachePolicy="memory-disk"
                            transition={180}
                            onError={() => setFailedBannerIds(ids => ids.includes(banner.id) ? ids : [...ids, banner.id])}
                            onLoad={() => setFailedBannerIds(ids => ids.filter(id => id !== banner.id))}
                          />
                        </>
                      ) : null}
                      {hasCopy ? (
                        <View style={styles.bannerDetails} pointerEvents="none">
                          {banner.title?.trim()?<Text style={styles.carouselTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{banner.title}</Text>:null}
                          {banner.subtitle?.trim()?<Text style={styles.carouselSubtitle} numberOfLines={2}>{banner.subtitle}</Text>:null}
                          {banner.buttonText?.trim()?<View style={styles.carouselButton}>
                            <Text style={styles.carouselButtonText} numberOfLines={1}>{banner.buttonText}</Text>
                            <Ionicons name="chevron-forward" size={10} color="#131313"/>
                          </View>:null}
                        </View>
                      ):null}
                      {failedBannerIds.includes(banner.id) ? (
                        <View style={styles.bannerError} pointerEvents="none">
                          <Ionicons name="image-outline" size={20} color="#FFFFFF" />
                          <Text style={styles.bannerErrorText}>Banner görseli yüklenemedi</Text>
                        </View>
                      ) : null}
                    </Pressable>;
                  })}
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
              <View pointerEvents="none" style={styles.carouselOutline}/>
            </View>
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
          renderProduct={(product,width)=>renderHomeProductCard(product,false,width)}
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
            {wholesale.slice(0, 10).map(product => renderHomeProductCard(product,false,wholesaleWidth))}
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
        {refreshing ? (
          <View pointerEvents="none" style={styles.brandedRefreshOverlay} accessibilityLabel="Çalışkan B2B yenileniyor">
            {refreshAnimationImageId && !refreshGifFailed && homepageMediaUrl(refreshAnimationImageId) ? (
              <Image source={{uri:homepageMediaUrl(refreshAnimationImageId)!}}
                style={styles.brandedRefreshGif} contentFit="contain" cachePolicy="memory-disk"
                onError={()=>setRefreshGifFailed(true)}/>
            ) : (
              <Animated.View style={[styles.brandedRefreshFallback,{
                opacity:refreshPulse.interpolate({inputRange:[0,1],outputRange:[0.72,1]}),
                transform:[{scale:refreshPulse.interpolate({inputRange:[0,1],outputRange:[0.96,1.04]})}],
              }]}>
                <Text style={styles.brandedRefreshWordmark}>ÇALIŞKAN <Text style={styles.brandedRefreshHighlight}>B2B</Text></Text>
                <Text style={styles.brandedRefreshCaption}>Güncelleniyor...</Text>
              </Animated.View>
            )}
          </View>
        ) : null}
      </View>
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
  stickyHomeTop:{width:'100%',backgroundColor:'#111113',zIndex:10},
  scrollableHomeContent:{flex:1,minHeight:0},
  brandedRefreshOverlay:{position:'absolute',top:7,left:0,right:0,alignItems:'center',zIndex:12},
  brandedRefreshGif:{width:180,height:62},
  brandedRefreshFallback:{minWidth:174,minHeight:54,borderRadius:13,borderWidth:1,borderColor:'#CBA527',backgroundColor:'#171717',
    alignItems:'center',justifyContent:'center',paddingHorizontal:13,paddingVertical:7},
  brandedRefreshWordmark:{fontSize:17,fontWeight:'900',color:'#FFCD00'},
  brandedRefreshHighlight:{fontSize:13,color:'#FFFFFF'},
  brandedRefreshCaption:{fontSize:10,fontWeight:'500',color:'#F1E9BA',marginTop:2},
  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: 120,
    position: 'relative',
  },
  homeBrandHeader: {
    // Full-bleed artwork starts under the transparent iOS status bar.
    minHeight:0,
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
    minHeight:0,
    paddingHorizontal:spacing.lg,
    paddingBottom:2,
    alignItems:'center',
    justifyContent:'center',
  },
  homeBrandMain: {width:'100%',alignItems:'center',justifyContent:'center'},
  homeBrandLogoRow: {width:'100%',paddingHorizontal:72,alignItems:'center',justifyContent:'center'},
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
  homeBrandLogo: {width:'100%',height:46,backgroundColor:'transparent'},
  homeBrandFallback: {color:'#FFFFFF',fontSize:23,fontWeight:'900',letterSpacing:0.3},
  homeBrandTaglineArtwork:{
    width:'86%',maxWidth:340,height:34,marginTop:0,backgroundColor:'transparent',
  },
  homeBrandTaglineRow:{
    flexDirection:'row',alignItems:'center',justifyContent:'center',
    maxWidth:'90%',marginTop:0,paddingBottom:4,
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
  scanButton: { width:32,height:32,alignItems:'center',justifyContent:'center' },
  scanGlyph: { width:22,height:20,alignItems:'center',justifyContent:'center' },
  scanCorner: {position:'absolute',width:6,height:6,borderColor:'#202124'},
  scanBars: {flexDirection:'row',alignItems:'center',gap:0.8},
  scanBar: {height:13,backgroundColor:'#202124'},
  searchResults: { gap: 8, marginTop: 15 },
  searchResultHeading: { color: palette.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 3 },
  searchResultRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 8 },
  searchResultThumb: { width: 56, height: 56, backgroundColor: '#FFFFFF', borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  searchResultImage: { width: '100%', height: '100%' },
  searchResultBody: { flex: 1, minWidth: 0 },
  searchResultTitle: { color: palette.text, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  searchResultSku: { color: palette.textSecondary, fontSize: 11, marginTop: 5 },
  searchResultEmpty: { color: palette.textSecondary, fontSize: 14, padding: 15, textAlign: 'center' },
  carouselContainer: {marginTop:2,alignSelf:'center',borderRadius:13,overflow:'hidden',backgroundColor:'#171719'},
  carouselOutline:{...StyleSheet.absoluteFillObject,borderWidth:1,borderColor:'#737375',borderRadius:13},
  carouselImageBackdrop:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},
  carouselImage: {...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},
  carouselSideImage:{position:'absolute',right:0,top:0,bottom:0,width:'53%',height:'100%'},
  bannerError:{position:'absolute',top:4,right:5,flexDirection:'row',gap:4,alignItems:'center',padding:4,borderRadius:6,backgroundColor:'rgba(0,0,0,0.65)'},
  bannerErrorText:{color:'#FFFFFF',fontSize:9,fontWeight:'700'},
  carouselSlide:{overflow:'hidden',backgroundColor:'#171719'},
  bannerDetails:{position:'absolute',left:0,top:0,bottom:0,width:'48%',paddingHorizontal:10,paddingVertical:3,justifyContent:'center',alignItems:'flex-start',backgroundColor:'#171719',gap:1},
  carouselTitle:{color:'#FFFFFF',fontSize:13,lineHeight:14,fontWeight:'800'},
  carouselSubtitle:{color:'#F1F1F1',fontSize:8,lineHeight:9},
  carouselButton:{flexDirection:'row',alignItems:'center',gap:3,marginTop:2,borderRadius:5,backgroundColor:'#FFCD00',minHeight:17,paddingHorizontal:6,maxWidth:'100%'},
  carouselButtonText:{color:'#101010',fontSize:9,fontWeight:'700',flexShrink:1},
  carouselDots:{position:'absolute',left:0,right:0,bottom:3,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:4},
  carouselDot:{width:5,height:5,borderRadius:3,backgroundColor:'rgba(255,255,255,0.65)'},
  carouselDotActive:{width:11,backgroundColor:'#FFCD00'},
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
    paddingTop:2,
    paddingBottom:9,
  },
  headerRow: {flexDirection:'row',alignItems:'center',marginTop:0},
  headerSearchBox: {flex:1,marginTop:0,minWidth:0},
  searchBox: {
    minHeight:32,borderRadius:8,borderWidth:0,backgroundColor:'#F8F8F8',
    paddingLeft:12,paddingRight:5,flexDirection:'row',alignItems:'center',gap:7,
  },
  searchInput: {flex:1,minWidth:0,fontSize:12,fontWeight:'300',color:'#222225',height:32,paddingVertical:0},
  categoryQuickRow:{flexDirection:'row',flexWrap:'nowrap',alignItems:'stretch',gap:4,marginTop:7,paddingBottom:1},
  sectionHeader: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: palette.text,
    fontWeight: '500',
  },
  sectionSubtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  sectionAction: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.text,
    fontWeight: '400',
  },
  productCount: {
    ...typography.caption,
    color: palette.muted,
  },
  categoryCard:{
    flex:1,minWidth:0,height:57,borderRadius:9,borderWidth:1,
    borderColor:'#414146',borderTopColor:'#505055',borderBottomColor:'#303034',
    backgroundColor:'#2A2A2D',
    shadowColor:'#000000',shadowOffset:{width:0,height:2},
    shadowOpacity:0.38,shadowRadius:3,elevation:3,
    alignItems:'center',justifyContent:'center',gap:3,
    paddingHorizontal:2,paddingVertical:3,
  },
  categoryImage:{width:'78%',maxWidth:30,height:24,borderRadius:4},
  categoryText:{
    fontSize:8,lineHeight:10,color:'#F1F1F2',
    fontWeight:'400',textAlign:'center',width:'100%',
  },
  allCategoriesCard:{
    flex:1,minWidth:0,height:57,borderRadius:9,borderWidth:1,
    borderColor:'#FFCD00',backgroundColor:'#2A2A2D',
    shadowColor:'#000000',shadowOffset:{width:0,height:2},
    shadowOpacity:0.38,shadowRadius:3,elevation:3,
    alignItems:'center',justifyContent:'center',gap:3,
    paddingHorizontal:2,paddingVertical:3,
  },
  allCategoriesText:{
    fontSize:8,lineHeight:10,color:'#F1F1F2',fontWeight:'400',textAlign:'center',width:'100%',
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
  newArrivalLabel: { fontSize: 10, color: '#15803D', fontWeight: '500', letterSpacing: 0.5 },
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
