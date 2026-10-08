import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { Audio, Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

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

  const videoUrl = absoluteMediaUrl(item.video_url);
  const poster = absoluteMediaUrl(item.thumbnail_url);

  useEffect(() => {
    if (active) {
      setPaused(false);
      setVideoError(false);
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
          <Video
            ref={videoRef}
            source={{ uri: videoUrl }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            posterSource={poster ? { uri: poster } : undefined}
            usePoster={Boolean(poster)}
            shouldPlay={false}
            isLooping
            isMuted={false}
            volume={1}
            useNativeControls={false}
            progressUpdateIntervalMillis={250}
            onLoad={() => {
              setLoaded(true);
              if (playing) {
                void videoRef.current?.playAsync().catch(() => undefined);
              }
            }}
            onReadyForDisplay={() => {
              if (playing) {
                void videoRef.current?.playAsync().catch(() => undefined);
              }
            }}
            onError={() => {
              setLoaded(false);
              setVideoError(true);
            }}
            pointerEvents="none"
          />
        ) : poster ? (
          <View style={styles.posterWrap}>
            <VideoFallback />
          </View>
        ) : (
          <VideoFallback />
        )}

        {!playing ? (
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={30} color="#FFFFFF" />
            </View>
          </View>
        ) : null}

        <View style={styles.gradientTop} />
        <View style={styles.gradientBottom} />
      </Pressable>

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
        <Text style={styles.reelTitle}>{item.title || 'Ürün videosu'}</Text>
        <Text style={styles.tapHint}>Durdurmak / oynatmak için videoya dokunun</Text>

        {item.product_id ? (
          <Pressable
            style={styles.productButton}
            onPress={() =>
              router.push({
                pathname: '/product/[id]',
                params: { id: String(item.product_id) },
              } as never)
            }
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
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => undefined);

    rmaApi
      .listB2BReels()
      .then((data) => setReels(Array.isArray(data) ? data : []))
      .catch(() => setReels([]))
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
                active={index === activeIndex}
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
  gradientTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 130,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  gradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
    backgroundColor: 'rgba(0,0,0,0.34)',
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
