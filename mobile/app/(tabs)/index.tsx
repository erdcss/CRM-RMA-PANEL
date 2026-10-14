import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BarcodeScannerModal } from '@/components/packages/BarcodeScannerModal';
import { appAlert } from '@/lib/appAlert';

import { Screen } from '@/components/ui/Screen';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { B2B_HEADER_LOGO } from '@/assets/header-logo';
import { managedHeaderLogo } from '@/lib/managed-header-logo';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  absoluteMediaUrl,
  rmaApi,
  type B2BOrderSummary,
  type B2BProduct,
  type B2BReel,
  type HomeBanner,
  type HomeCategoryCard,
} from '@/lib/api';
import { useMobileBranding, refreshMobileBranding } from '@/lib/branding';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

function money(value: string | number | null | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

function orderStatusLabel(value?: string | null) {
  const status = String(value || '').toLowerCase();
  if (status === 'paid') return 'Ödeme alındı';
  if (status === 'paid_stock_review') return 'Stok kontrolünde';
  if (status === 'awaiting_bank_transfer') return 'Havale bekleniyor';
  if (status === 'bank_transfer_notified') return 'Havale bildirildi';
  if (status === 'cancel_requested') return 'İptal talebi alındı';
  if (status === 'completed') return 'Tamamlandı';
  if (status === 'cancelled') return 'İptal edildi';
  return status ? status.replace(/_/g, ' ') : 'Sipariş güncellendi';
}

function shortDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
  });
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
  const { palette, mode } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  const [welcome, setWelcome] = useState(false);
  const welcomeFade = useRef(new Animated.Value(0)).current;
  const welcomeShift = useRef(new Animated.Value(-24)).current;

  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [reels, setReels] = useState<B2BReel[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryCards, setCategoryCards] = useState<HomeCategoryCard[]>([]);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [sliderAutoPlay, setSliderAutoPlay] = useState(true);
  const [sliderIntervalMs, setSliderIntervalMs] = useState(5000);
  const [bannerWidth, setBannerWidth] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerScrollRef = useRef<ScrollView>(null);
  const bannerIndexRef = useRef(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const scanLockedRef = useRef(false);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [notifications, setNotifications] = useState<B2BOrderSummary[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const notificationDrawer = useRef(new Animated.Value(0)).current;

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

  const load = useCallback(async (forceRefresh = false) => {
    const [productResult, homepageResult] = await Promise.allSettled([
      rmaApi.listB2BProducts(forceRefresh),
      rmaApi.getB2BHomepage(),
    ]);

    if (productResult.status === 'fulfilled') {
      setProducts(Array.isArray(productResult.value) ? productResult.value : []);
    }

    if (homepageResult.status === 'fulfilled') {
      setCategories(homepageResult.value.categories || []);
      setCategoryCards(homepageResult.value.categoryCards || []);
      setBanners(homepageResult.value.banners || []);
      setSliderAutoPlay(homepageResult.value.sliderAutoPlay !== false);
      setSliderIntervalMs(homepageResult.value.sliderIntervalMs || 5000);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, session?.access_token]);

  useEffect(() => {
    void rmaApi.listB2BReels().then(items => setReels(Array.isArray(items) ? items.slice(0, 6) : [])).catch(() => setReels([]));
  }, []);

  useEffect(() => {
    let active = true;

    if (!session) {
      setNotifications([]);
      return () => {
        active = false;
      };
    }

    void rmaApi
      .listB2BOrders()
      .then((rows) => {
        if (active) {
          setNotifications(Array.isArray(rows) ? rows.slice(0, 8) : []);
        }
      })
      .catch(() => {
        if (active) setNotifications([]);
      });

    return () => {
      active = false;
    };
  }, [session?.access_token]);

  useFocusEffect(useCallback(() => {
    void refreshMobileBranding();
    let mounted=true;
    if (!session?.user?.id) {setUnreadNotifications(0);return () => { mounted=false; }; }
    void rmaApi.listB2BNotifications().then(rows => {
      if (mounted) setUnreadNotifications(rows.filter(row => !row.read_at).length);
    }).catch(() => undefined);
    return () => { mounted=false; };
  }, [session?.user?.id]));

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
        Boolean(search) || !category ||
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

  const handleScannedBarcode = async (value: string) => {
    if (scanLockedRef.current) return;
    scanLockedRef.current = true;
    setScannerOpen(false);
    try {
      const product = await rmaApi.findB2BProductByBarcode(value);
      router.push({ pathname: '/product/[id]', params: { id: String(product.id) } } as never);
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

  const toggleNotifications = () => {
    const next = !notificationsOpen;
    setNotificationsOpen(next);
    Animated.timing(notificationDrawer, {
      toValue: next ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
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
        <View style={styles.topRow}>
          <BrandLogo
            uri={branding.b2b_mobile_header_logo || managedHeaderLogo || B2B_HEADER_LOGO}
            style={styles.logo}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              style={styles.notificationButton}
              onPress={() => router.push('/(tabs)/orders')}
              accessibilityRole="button"
              accessibilityLabel="Sipariş listesine git"
            >
              <Ionicons name="cart-outline" size={23} color={palette.text} />
            </Pressable>
            <Pressable
              style={[styles.notificationButton, notificationsOpen && styles.notificationButtonActive]}
              onPress={() => router.push('/notifications' as never)}
              accessibilityRole="button"
              accessibilityLabel="Bildirimleri aç"
            >
              <Ionicons
                name={notificationsOpen ? 'notifications' : 'notifications-outline'}
                size={22}
                color={palette.text}
              />
              {unreadNotifications > 0 ? <View style={styles.notificationDot} /> : null}
            </Pressable>
          </View>
        </View>

        <Animated.View
          pointerEvents={notificationsOpen ? 'auto' : 'none'}
          style={[
            styles.notificationDrawer,
            {
              maxHeight: notificationDrawer.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 360],
              }),
              opacity: notificationDrawer,
              transform: [
                {
                  translateY: notificationDrawer.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.notificationDrawerHeader}>
            <View>
              <Text style={styles.notificationDrawerEyebrow}>BİLDİRİMLER</Text>
              <Text style={styles.notificationDrawerTitle}>
                Son sipariş hareketleri
              </Text>
            </View>
            <Pressable
              style={styles.notificationClose}
              onPress={toggleNotifications}
            >
              <Ionicons name="close" size={18} color={palette.text} />
            </Pressable>
          </View>

          {!session ? (
            <View style={styles.notificationEmpty}>
              <Ionicons
                name="lock-closed-outline"
                size={17}
                color={palette.muted}
              />
              <Text style={styles.notificationEmptyTitle}>
                Bildirimler için giriş yapın
              </Text>
              <Text style={styles.notificationEmptyText}>
                Sipariş ve ödeme hareketleri hesabınızla giriş yaptıktan sonra burada listelenir.
              </Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.notificationEmpty}>
              <Ionicons
                name="notifications-off-outline"
                size={24}
                color={palette.muted}
              />
              <Text style={styles.notificationEmptyTitle}>
                Yeni bildirim yok
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.notificationList}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {notifications.map((item, index) => (
                <View
                  key={String(item.id)}
                  style={[
                    styles.notificationItem,
                    index === notifications.length - 1 &&
                      styles.notificationItemLast,
                  ]}
                >
                  <View style={styles.notificationIcon}>
                    <Ionicons
                      name="bag-check-outline"
                      size={18}
                      color={palette.text}
                    />
                  </View>
                  <View style={styles.notificationText}>
                    <Text style={styles.notificationTitle} numberOfLines={1}>
                      {item.order_number || `Sipariş #${item.id}`}
                    </Text>
                    <Text style={styles.notificationSubtitle} numberOfLines={1}>
                      {orderStatusLabel(item.status)}
                    </Text>
                  </View>
                  <View style={styles.notificationMeta}>
                    <Text style={styles.notificationDate}>
                      {shortDate(item.created_at)}
                    </Text>
                    {item.total_amount != null ? (
                      <Text style={styles.notificationAmount}>
                        {money(item.total_amount)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Animated.View>

        <View style={styles.searchBox}>
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


        {query.trim() ? (
          <View style={styles.searchResults}>
            <Text style={styles.searchResultHeading}>Arama Sonuçları · {filtered.length} ürün</Text>
            {filtered.slice(0, 50).map((product) => {
              const picture = productImage(product);
              return <Pressable key={String(product.id)} style={styles.searchResultRow}
                onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(product.id) } } as never)}>
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
          <View style={styles.carouselContainer} onLayout={(event) => setBannerWidth(event.nativeEvent.layout.width)}>
            {bannerWidth > 0 ? (
              <ScrollView ref={bannerScrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                scrollEventThrottle={100}
                onMomentumScrollEnd={(event) => {
                  const next = Math.round(event.nativeEvent.contentOffset.x / bannerWidth);
                  bannerIndexRef.current = next;
                  setBannerIndex(next);
                }}>
                {banners.map(banner => (
                  <View key={banner.id} style={[styles.carouselSlide, { width: bannerWidth }]}>
                    {banner.imageId ? (
                      <Image source={{ uri: absoluteMediaUrl(`/api/public/homepage/media/${banner.imageId}`) || '' }}
                        style={StyleSheet.absoluteFillObject} contentFit="cover" />
                    ) : null}
                    <View style={styles.carouselOverlay} />
                    <View style={styles.carouselContent}>
                      <Text style={styles.carouselTitle} numberOfLines={3}>{banner.title || 'Çalışkan B2B'}</Text>
                      {banner.subtitle ? <Text style={styles.carouselSubtitle} numberOfLines={3}>{banner.subtitle}</Text> : null}
                      {banner.buttonText ? (
                        <Pressable style={styles.carouselButton} onPress={() => router.push('/(tabs)/menu')}>
                          <Text style={styles.carouselButtonText}>{banner.buttonText}</Text>
                          <Ionicons name="arrow-forward" size={15} color="#131313" />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            {banners.length > 1 ? <View style={styles.carouselDots}>
              {banners.map((banner, index) => (
                <View key={banner.id} style={[styles.carouselDot, index === bannerIndex && styles.carouselDotActive]} />
              ))}
            </View> : null}
          </View>
        ) : (
          <View style={styles.heroBanner}>
            <View style={styles.heroIconCircle}><Ionicons name="cube-outline" size={30} color="#FFCD00" /></View>
            <Text style={styles.heroEyebrow}>ÇALIŞKAN B2B · TOPTAN TEDARİK</Text>
            <Text style={styles.heroTitle}>İşinizi daha güçlü yarınlara taşıyın.</Text>
            <Text style={styles.heroDescription}>Geniş ürün yelpazesi ve işletmelere özel avantajlarla yanınızdayız.</Text>
            <Pressable style={styles.heroAction} onPress={() => router.push('/(tabs)/menu')}>
              <Text style={styles.heroActionText}>Alışverişe Başla</Text>
              <Ionicons name="arrow-forward" size={16} color="#171717" />
            </Pressable>
          </View>
        )}

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
              size={17}
              color={!selectedCategory ? '#FFFFFF' : palette.text}
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
            const configured = categoryCards.find((item) => item.category === category);
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
                {configured?.imageId ? (
                  <Image source={{ uri: absoluteMediaUrl(`/api/public/homepage/media/${configured.imageId}`) || '' }}
                    style={styles.categoryImage} contentFit="cover" />
                ) : (
                  <Ionicons name={icons[index % icons.length]} size={28}
                    color={active ? '#FFFFFF' : palette.text} />
                )}
                <Text
                  numberOfLines={2}
                  style={[
                    styles.categoryText,
                    active && styles.categoryTextActive,
                  ]}
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
                {reel.thumbnail_url ? <Image source={{ uri: absoluteMediaUrl(reel.thumbnail_url) || '' }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : null}
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
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={36} color={palette.muted} />
            <Text style={styles.emptyTitle}>Ürün bulunamadı</Text>
            <Text style={styles.emptyText}>
              Arama veya kategori filtresini değiştirin.
            </Text>
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
  heroBanner: { backgroundColor:'#17191C', borderWidth:1,borderColor:'#3E3930',borderRadius:18,padding:20,marginTop:18,overflow:'hidden' },
  heroIconCircle:{ width:48,height:48,borderRadius:13,backgroundColor:'#2D2A1F',alignItems:'center',justifyContent:'center',marginBottom:18 },
  heroEyebrow:{ color:'#FFCD00',fontSize:10,fontWeight:'900',letterSpacing:1.2,marginBottom:8 },
  heroTitle:{ color:'#FFFFFF',fontSize:25,fontWeight:'900',lineHeight:30,maxWidth:'96%' },
  heroDescription:{ color:'#D3D6DA',fontSize:13,lineHeight:20,marginTop:10,maxWidth:'93%' },
  heroAction:{ backgroundColor:'#FFCD00',height:44,alignSelf:'flex-start',paddingHorizontal:16,borderRadius:11,flexDirection:'row',alignItems:'center',gap:9,marginTop:18 },
  heroActionText:{ color:'#151515',fontSize:13,fontWeight:'900' },
  reelPreviewCard:{ width:128,height:170,borderRadius:13,overflow:'hidden',backgroundColor:'#23262A',borderWidth:1,borderColor:'#41454A' },
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
  carouselContainer: { marginTop: 15, height: 218, borderRadius: 17, overflow: 'hidden', backgroundColor: '#202124' },
  carouselSlide: { height: 218, justifyContent: 'flex-end', overflow: 'hidden' },
  carouselOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.48)' },
  carouselContent: { padding: 20, paddingBottom: 28, maxWidth: '94%' },
  carouselTitle: { color: '#FFFFFF', fontSize: 23, lineHeight: 28, fontWeight: '900' },
  carouselSubtitle: { color: '#F0F0F0', fontSize: 13, marginTop: 8, lineHeight: 19 },
  carouselButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, alignSelf: 'flex-start', borderRadius: 9, backgroundColor: '#FFCD00', minHeight: 38, paddingHorizontal: 13 },
  carouselButtonText: { color: '#101010', fontSize: 12, fontWeight: '800' },
  carouselDots: { position: 'absolute', right: 15, bottom: 9, flexDirection: 'row', gap: 6 },
  carouselDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  carouselDotActive: { width: 19, backgroundColor: '#FFCD00' },
  categoryImage: { width: 70, height: 67, borderRadius: 8 },
  topRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 192,
    height: 53,
  },
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
  notificationButtonActive: {
    borderColor: palette.text,
    backgroundColor: palette.surfaceSecondary,
  },
  notificationDrawer: {
    position: 'absolute',
    top: 72,
    right: spacing.lg,
    width: 330,
    maxWidth: '90%',
    zIndex: 50,
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 18,
  },
  notificationDrawerHeader: {
    minHeight: 66,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  notificationDrawerEyebrow: {
    ...typography.caption,
    color: palette.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  notificationDrawerTitle: {
    ...typography.bodyMedium,
    color: palette.text,
    fontWeight: '900',
    marginTop: 2,
  },
  notificationClose: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: palette.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationList: {
    maxHeight: 282,
  },
  notificationItem: {
    minHeight: 68,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  notificationItemLast: {
    borderBottomWidth: 0,
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitle: {
    ...typography.caption,
    color: palette.text,
    fontWeight: '900',
  },
  notificationSubtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  notificationMeta: {
    alignItems: 'flex-end',
  },
  notificationDate: {
    ...typography.caption,
    fontSize: 9,
    color: palette.muted,
  },
  notificationAmount: {
    ...typography.caption,
    color: palette.text,
    fontWeight: '800',
    marginTop: 2,
  },
  notificationEmpty: {
    minHeight: 150,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationEmptyTitle: {
    ...typography.bodyMedium,
    color: palette.text,
    fontWeight: '800',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  notificationEmptyText: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 17,
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
    width: 112,
    height: 112,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  categoryCardActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  categoryText: {
    ...typography.caption,
    color: palette.text,
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
