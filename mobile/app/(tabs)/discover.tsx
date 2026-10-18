import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { Audio, Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { absoluteMediaUrl, rmaApi, type B2BReel } from '@/lib/api';

function ReelCard({
  item,
  active,
  height,
}: {
  item: B2BReel;
  active: boolean;
  height: number;
}) {
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [retry, setRetry] = useState(0);
  const [errorDetail, setErrorDetail] = useState('');

  const videoUrl = absoluteMediaUrl(item.video_url);
  const sourceUrl = videoUrl && retry ? `${videoUrl}${videoUrl.includes('?') ? '&' : '?'}retry=${retry}` : videoUrl;
  const poster = absoluteMediaUrl(item.thumbnail_url);

  useEffect(() => {
    if (active) {
      setPaused(false);
      setVideoError(false);
      setBuffering(true);
    } else {
      void videoRef.current?.pauseAsync().catch(() => undefined);
    }
  }, [active]);

  const playing = active && !paused && !videoError;

  useEffect(() => {
    if (!videoRef.current || !loaded || videoError) return;

    if (playing) {
      void videoRef.current.playAsync().catch(() => undefined);
    } else {
      void videoRef.current.pauseAsync().catch(() => undefined);
    }
  }, [loaded, playing, videoError]);

  return (
    <View style={[styles.reelPage, { height }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setPaused((value) => !value)}
      >
        {videoUrl && !videoError ? (
          <>
            <Video
              key={String(item.id) + '-' + retry}
              ref={videoRef}
              source={{ uri: sourceUrl! }}
              style={styles.video}
              resizeMode={ResizeMode.COVER}
              shouldPlay={playing}
              isLooping
              isMuted={false}
              volume={1}
              useNativeControls={false}
              progressUpdateIntervalMillis={500}
              onLoadStart={() => { setLoaded(false); setBuffering(true); }}
              onLoad={() => {
                setLoaded(true);
                setBuffering(false);
                if (playing) {
                  void videoRef.current?.playAsync().catch((error) => {
                    setErrorDetail(error instanceof Error ? error.message : String(error));
                    setVideoError(true);
                  });
                }
              }}
              onPlaybackStatusUpdate={(status) => {
                if (!status.isLoaded) {
                  if (status.error) {
                    setErrorDetail(status.error);
                    setVideoError(true);
                    setBuffering(false);
                  }
                  return;
                }
                setBuffering(Boolean(status.isBuffering));
              }}
              onError={(error) => {
                setLoaded(false);
                setBuffering(false);
                setErrorDetail(String(error || 'Video formatı veya bağlantı hatası'));
                setVideoError(true);
              }}
              pointerEvents="none"
            />
            {!loaded && poster ? (
              <Image
                source={{ uri: poster }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                pointerEvents="none"
              />
            ) : null}
            {buffering && active ? (
              <View style={styles.loadingIndicator} pointerEvents="none">
                <ActivityIndicator color="#FFFFFF" size="large" />
              </View>
            ) : null}
          </>
        ) : videoError ? (
          <View style={styles.posterWrap}>
            {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : <VideoFallback />}
          </View>
        ) : poster ? (
          <Image source={{ uri: poster }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        ) : (
          <VideoFallback />
        )}

        {!playing && !videoError ? (
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={30} color="#FFFFFF" />
            </View>
          </View>
        ) : null}

      </Pressable>

      {videoError ? (
        <Pressable
          style={[styles.playOverlay, { zIndex: 10 }]}
          onPress={() => { setVideoError(false); setErrorDetail(''); setLoaded(false); setBuffering(true); setPaused(false); setRetry(value => value + 1); }}
          accessibilityRole="button"
          accessibilityLabel="Videoyu yeniden dene"
        >
          <View style={styles.playButton}>
            <Ionicons name="refresh" size={28} color="#FFFFFF" />
          </View>
          <Text style={{ color: '#FFFFFF', marginTop: 16, fontWeight: '800' }}>Videoyu yeniden dene</Text>
          <Text style={styles.errorDetails} numberOfLines={2}>{errorDetail || 'Video açılamadı. Bağlantıyı kontrol edin.'}</Text>
        </Pressable>
      ) : null}

      {videoError && videoUrl ? (
        <Pressable style={styles.openExternally} accessibilityRole="button"
          onPress={() => void Linking.openURL(videoUrl).catch(() => undefined)}>
          <Text style={{ color:'#FFFFFF', fontWeight:'800', fontSize:12 }}>Videoyu tarayıcıda aç</Text>
          <Ionicons name="open-outline" color="#FFFFFF" size={16} />
        </Pressable>
      ) : null}
      <View style={styles.topBar} pointerEvents="none">
        <View>
          <Text style={styles.eyebrow}>ÇALIŞKAN B2B</Text>
          <Text style={styles.discoverTitle}>Keşfet</Text>
        </View>
        <View style={styles.reelsBadge}>
          <Ionicons name="play-circle" size={17} color="#FFFFFF" />
          <Text style={styles.reelsBadgeText}>Reels</Text>
        </View>
      </View>

      <View style={styles.captionArea} pointerEvents="box-none">
        {item.seller_slug && item.seller_name ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={item.seller_name + ' mağazasını görüntüle'}
            style={styles.sellerRow}
            onPress={() => router.push({pathname:'/marketplace/store/[slug]',params:{slug:item.seller_slug!}} as never)}
          >
            <View style={styles.sellerAvatar}>
              {item.seller_logo_url ? (
                <Image source={{ uri: absoluteMediaUrl(item.seller_logo_url) || item.seller_logo_url }} style={styles.sellerImage} contentFit="contain" />
              ) : <Ionicons name="storefront-outline" size={24} color="#854D0E" />}
            </View>
            <View style={styles.sellerDetails}>
              <Text style={styles.sellerName} numberOfLines={1}>{item.seller_name}</Text>
              <Text style={styles.sellerLink}>Mağazayı Gör →</Text>
            </View>
 
          </Pressable>
        ) : null}
        <Text style={styles.reelTitle}>{item.title || 'Ürün videosu'}</Text>
        <Text style={styles.tapHint}>Durdurmak / oynatmak için videoya dokunun</Text>

        {item.product_id ? (
          <Pressable
            style={styles.productButton}
            onPress={() => {
              if (item.marketplace && item.seller_slug) {
                router.push({pathname:'/product/[id]',params:{id:'mp-'+String(item.product_id),slug:item.seller_slug}} as never);
              } else {
                router.push({pathname:'/product/[id]',params:{id:String(item.product_id)}} as never);
              }
            }}
          >
            <Ionicons name="bag-handle-outline" size={18} color={colors.text} />
            <Text style={styles.productButtonText}>Ürünü Gör</Text>
            <Ionicons name="arrow-forward" size={17} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function VideoFallback() {
  return (
    <View style={styles.videoFallback}>
      <Ionicons name="videocam-off-outline" size={42} color="#FFFFFF" />
      <Text style={styles.videoFallbackTitle}>Video açılamadı</Text>
      <Text style={styles.videoFallbackText}>
        Video dosyasını veya bağlantısını admin panelinden kontrol edin.
      </Text>
    </View>
  );
}

export default function DiscoverScreen() {
  const [reels, setReels] = useState<B2BReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => undefined);

    // Keep editorial Reels available even if the seller marketplace is temporarily offline.
    Promise.allSettled([rmaApi.listB2BReels(), rmaApi.listMarketplaceReels()])
      .then(([editorial, marketplace]) => {
        const curated = editorial.status === 'fulfilled' && Array.isArray(editorial.value) ? editorial.value : [];
        const sellers = marketplace.status === 'fulfilled' && Array.isArray(marketplace.value) ? marketplace.value : [];
        setReels([...sellers, ...curated]);
      })
      .finally(() => setLoading(false));
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 72,
    minimumViewTime: 120,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<B2BReel>[] }) => {
      const first = viewableItems.find((entry) => entry.isViewable);
      if (typeof first?.index === 'number') {
        setActiveIndex(first.index);
      }
    },
  ).current;

  return (
    <Screen style={styles.screen}>
      <View
        style={styles.viewport}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      >
        {viewportHeight > 0 ? (
          <FlatList
            data={reels}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item, index }) => (
              <ReelCard
                item={item}
                active={focused && index === activeIndex}
                height={viewportHeight}
              />
            )}
            pagingEnabled
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            bounces={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(_, index) => ({
              length: viewportHeight,
              offset: viewportHeight * index,
              index,
            })}
            ListEmptyComponent={
              <View style={[styles.empty, { height: viewportHeight }]}>
                <Ionicons
                  name="videocam-outline"
                  size={42}
                  color={colors.textMuted}
                />
                <Text style={styles.emptyTitle}>
                  {loading ? 'Videolar yükleniyor…' : 'Henüz video eklenmedi'}
                </Text>
                {!loading ? (
                  <Text style={styles.emptyText}>
                    Admin panelde Reelsler alanına yüklenen aktif videolar burada tam ekran gösterilir.
                  </Text>
                ) : null}
              </View>
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#050505',
  },
  viewport: {
    flex: 1,
    backgroundColor: '#050505',
  },
  reelPage: {
    width: '100%',
    backgroundColor: '#050505',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#050505',
  },
  loadingIndicator: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  errorDetails: { color: '#E2E8F0', marginTop: 8, fontSize: 11, paddingHorizontal: 36, textAlign: 'center' },
  posterWrap: {
    flex: 1,
    backgroundColor: '#111827',
  },
  videoFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    backgroundColor: '#111827',
  },
  videoFallbackTitle: {
    ...typography.subtitle,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: spacing.md,
  },
  videoFallbackText: {
    ...typography.caption,
    color: '#CBD5E1',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  openExternally: { position:'absolute', zIndex:15, bottom:175, alignSelf:'center', backgroundColor:'#33373D', borderRadius:12, padding:12, flexDirection:'row', alignItems:'center', gap:8 },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    backgroundColor: 'rgba(15,23,42,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  topBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    ...typography.caption,
    color: '#CBD5E1',
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  discoverTitle: {
    ...typography.title,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: 1,
  },
  reelsBadge: {
    minHeight: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(15,23,42,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reelsBadgeText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  captionArea: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: 0,
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
  },
  sellerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FACC15',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  sellerImage: {width: '100%',height: '100%'},
  sellerDetails: {flex: 1, minWidth: 0},
  sellerName: {color:'#FFFFFF',fontSize:14,fontWeight:'400',letterSpacing:0.15},
  sellerLink: {color:'#FDE68A',fontSize:12,fontWeight:'400',marginTop:3},
  reelTitle: {
    ...typography.title,
    color: '#FFFFFF',
    fontWeight: '900',
    maxWidth: '88%',
  },
  tapHint: {
    ...typography.caption,
    color: '#CBD5E1',
    marginTop: spacing.xs,
  },
  productButton: {
    alignSelf: 'flex-start',
    minHeight: 46,
    marginTop: spacing.md,
    borderRadius: radius.full,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  productButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '900',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    backgroundColor: '#050505',
  },
  emptyTitle: {
    ...typography.title,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: '#CBD5E1',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
