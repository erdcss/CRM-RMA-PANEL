import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { rmaApi } from '@/lib/api';

export default function MenuScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    rmaApi
      .getB2BHomepage()
      .then((data) => setCategories(data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  const icons = useMemo<Array<keyof typeof Ionicons.glyphMap>>(
    () => [
      'home-outline',
      'flash-outline',
      'basket-outline',
      'construct-outline',
      'storefront-outline',
      'cube-outline',
      'layers-outline',
      'pricetag-outline',
    ],
    [],
  );

  const openCategory = (category: string) => {
    router.push({
      pathname: '/(tabs)',
      params: { category },
    });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ÇALIŞKAN B2B</Text>
          <Text style={styles.title}>Menü</Text>
          <Text style={styles.subtitle}>
            Kategoriler arasında gezinin ve aradığınız ürün grubuna ulaşın.
          </Text>
        </View>

        <Pressable style={styles.allCard} onPress={() => router.push('/(tabs)')}>
          <View style={styles.iconBoxDark}>
            <Ionicons name="apps-outline" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.textGroup}>
            <Text style={styles.allTitle}>Tüm Ürünler</Text>
            <Text style={styles.itemSubtitle}>Bütün Çalışkan B2B kataloğunu görüntüle</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>

        <View style={styles.list}>
          {categories.map((category, index) => (
            <Pressable
              key={category}
              style={styles.item}
              onPress={() => openCategory(category)}
            >
              <View style={styles.iconBox}>
                <Ionicons
                  name={icons[index % icons.length]}
                  size={22}
                  color={colors.text}
                />
              </View>
              <View style={styles.textGroup}>
                <Text style={styles.itemTitle}>{category}</Text>
                <Text style={styles.itemSubtitle}>
                  {category} ürünlerini görüntüle
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={19}
                color={colors.textMuted}
              />
            </Pressable>
          ))}
        </View>

        {categories.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="grid-outline" size={34} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Kategori bulunamadı</Text>
            <Text style={styles.emptyText}>
              Admin panelde ana sayfa kategorileri eklendiğinde burada listelenecek.
            </Text>
          </View>
        ) : null}
      </ScrollView>
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
  allCard: {
    minHeight: 78,
    borderRadius: radius.xl,
    backgroundColor: '#111827',
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iconBoxDark: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allTitle: {
    ...typography.subtitle,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  list: {
    gap: spacing.sm,
  },
  item: {
    minHeight: 74,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
  },
  itemTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '800',
  },
  itemSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  empty: {
    minHeight: 220,
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
