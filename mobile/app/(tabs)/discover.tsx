import { useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { absoluteMediaUrl, rmaApi, type B2BReel } from '@/lib/api';

const GAP = spacing.md;
const CARD_WIDTH = (Dimensions.get('window').width - spacing.lg * 2 - GAP) / 2;

export default function DiscoverScreen() {
  const router = useRouter();
  const [reels, setReels] = useState<B2BReel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rmaApi
      .listB2BReels()
      .then((data) => setReels(Array.isArray(data) ? data : []))
      .catch(() => setReels([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen>
      <FlatList
        data={reels}
        numColumns={2}
        keyExtractor={(item) => String(item.id)}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.page}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>ÜRÜNLERİ KEŞFET</Text>
            <Text style={styles.title}>Keşfet</Text>
            <Text style={styles.subtitle}>
              Ürün videolarını izleyin ve Çalışkan B2B kataloğunu keşfedin.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const videoUrl = absoluteMediaUrl(item.video_url);
          const poster = absoluteMediaUrl(item.thumbnail_url);

          return (
            <View style={styles.card}>
              <View style={styles.videoWrap}>
                {videoUrl ? (
                  <Video
                    source={{ uri: videoUrl }}
                    style={styles.video}
                    resizeMode={ResizeMode.COVER}
                    posterSource={poster ? { uri: poster } : undefined}
                    usePoster={Boolean(poster)}
                    useNativeControls
                    isLooping
                    shouldPlay={false}
                  />
                ) : (
                  <View style={styles.videoFallback}>
                    <Ionicons name="play-circle-outline" size={38} color="#FFFFFF" />
                  </View>
                )}
              </View>

              <View style={styles.body}>
                <Text style={styles.reelTitle} numberOfLines={2}>
                  {item.title}
                </Text>

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
                    <Text style={styles.productButtonText}>Ürünü Gör</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.text} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="videocam-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {loading ? 'Videolar yükleniyor…' : 'Henüz video eklenmedi'}
            </Text>
            {!loading ? (
              <Text style={styles.emptyText}>
                Admin panelde Reelsler bölümüne eklenen videolar burada görünür.
              </Text>
            ) : null}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 120,
  },
  header: {
    marginBottom: spacing.xl,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  title: {
    ...typography.largeTitle,
    color: colors.text,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    maxWidth: 320,
  },
  row: {
    gap: GAP,
    marginBottom: GAP,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  videoWrap: {
    width: '100%',
    aspectRatio: 9 / 15,
    backgroundColor: '#0F172A',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: spacing.md,
  },
  reelTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    minHeight: 42,
    fontWeight: '800',
  },
  productButton: {
    marginTop: spacing.sm,
    minHeight: 34,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productButtonText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  empty: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
