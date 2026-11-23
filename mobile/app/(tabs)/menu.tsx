import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { useAppearance, type AppPalette } from '@/contexts/AppearanceContext';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { rmaApi, homepageMediaUrl, type HomeCategoryCard } from '@/lib/api';

export default function MenuScreen() {
  const { palette } = useAppearance();
  const styles = useMemo(() => buildStyles(palette), [palette]);
  const router = useRouter();
  const {user}=useAuth();
  const mayAdd=user?.role==='super_admin'||user?.role==='b2b_seller';
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryCards, setCategoryCards] = useState<HomeCategoryCard[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    rmaApi
      .getB2BHomepage()
      .then((data) => {
        setCategories(Array.from(new Set([...(data.categories || []), ...(data.categoryCards || []).map(card => card.category)])));
        setCategoryCards(data.categoryCards || []);
      })
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
      pathname: '/collection/[category]',
      params: { category },
    } as never);
  };

  const openSubcategory = (category: string, subcategoryId: string) => {
    router.push({ pathname: '/collection/[category]', params: { category, subcategoryId } } as never);
  };

  return (
    <Screen style={{ backgroundColor: palette.background }}>
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

        {mayAdd?<Pressable style={[styles.allCard,{backgroundColor:'#FFCD00'}]}
          onPress={()=>router.push('/ai-product-studio' as never)}>
          <View style={styles.iconBoxDark}><Ionicons name="sparkles-outline" size={24} color="#FFF"/></View>
          <View style={styles.textGroup}><Text style={[styles.allTitle,{color:'#111827'}]}>AI ile Ürün Ekle</Text>
            <Text style={[styles.itemSubtitle,{color:'#334155'}]}>Görselden bilgiler, beyaz fon ve onay</Text></View>
          <Ionicons name="chevron-forward" size={19} color="#111827"/>
        </Pressable>:null}

        <View style={styles.list}>
          {categories.map((category, index) => {
            const card = categoryCards.find(item => item.category.toLocaleLowerCase('tr-TR') === category.toLocaleLowerCase('tr-TR'));
            const subcategories = card?.subcategories || [];
            const expanded = expandedCategory === category;
            return (
            <View key={category} style={styles.categoryGroup}>
            <Pressable
              style={styles.item}
              onPress={() => openCategory(category)}
            >
              <View style={styles.iconBox}>
                {card?.imageId ? <Image source={{ uri: homepageMediaUrl(card.imageId) || '' }} style={styles.categoryImage} contentFit="cover" cachePolicy="memory-disk" /> : <Ionicons
                  name={icons[index % icons.length]}
                  size={22}
                  color={palette.text}
                />}
              </View>
              <View style={styles.textGroup}>
                <Text style={styles.itemTitle}>{card?.label || category}</Text>
                <Text style={styles.itemSubtitle}>
                  {subcategories.length
                    ? subcategories.length + ' alt kategori · Ürünleri görüntüle'
                    : category + ' ürünlerini görüntüle'}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={19}
                color={palette.muted}
              />
            </Pressable>
            {subcategories.length > 0 ? (
              <>
                <Pressable
                  onPress={() => setExpandedCategory(current => current === category ? null : category)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  style={styles.subcategoryToggle}
                >
                  <Ionicons name="layers-outline" size={16} color={palette.textSecondary} />
                  <Text style={styles.subcategoryToggleText}>Alt Kategoriler ({subcategories.length})</Text>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textSecondary} />
                </Pressable>
                {expanded ? (
                  <View style={styles.subcategoryList}>
                    {subcategories.map(child => (
                      <Pressable key={child.id}
                        style={styles.subcategoryRow}
                        accessibilityRole="button"
                        accessibilityLabel={child.name + ' alt kategorisini aç'}
                        onPress={() => openSubcategory(category, child.id)}>
                        <View style={styles.childIcon}>
                          {child.imageId ? (
                            <Image source={{ uri: homepageMediaUrl(child.imageId) || '' }}
                              contentFit="cover" style={styles.childImage} cachePolicy="memory-disk" />
                          ) : <Ionicons name="cube-outline" size={19} color={palette.muted}/>}
                        </View>
                        <Text style={styles.childLabel} numberOfLines={2}>{child.name}</Text>
                        <Ionicons name="chevron-forward" size={17} color={palette.muted} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
            </View>
          );})}
        </View>

        {categories.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="grid-outline" size={34} color={palette.muted} />
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

const buildStyles = (palette: AppPalette) => StyleSheet.create({
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
    color: palette.muted,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  title: {
    ...typography.largeTitle,
    color: palette.text,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: palette.textSecondary,
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
  categoryGroup: { gap: 4 },
  subcategoryToggle: {
    marginLeft: 12, minHeight: 42, paddingHorizontal: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radius.md, backgroundColor: palette.surfaceSecondary,
  },
  subcategoryToggleText: { ...typography.caption, color: palette.textSecondary, flex: 1, fontWeight: '700' },
  subcategoryList: {
    marginLeft: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#FACC15', gap: 5,
  },
  subcategoryRow: {
    minHeight: 55, paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.md, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.border, flexDirection: 'row',
    alignItems: 'center', gap: spacing.md,
  },
  childIcon: {
    width: 36, height: 36, borderRadius: 9, backgroundColor: palette.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  childImage: { width: 36, height: 36 },
  childLabel: { ...typography.bodyMedium, fontSize: 13, fontWeight: '700', flex: 1, color: palette.text },
  item: {
    minHeight: 74,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryImage: { width: 44, height: 44, borderRadius: radius.lg },
  textGroup: {
    flex: 1,
  },
  itemTitle: {
    ...typography.bodyMedium,
    color: palette.text,
    fontWeight: '800',
  },
  itemSubtitle: {
    ...typography.caption,
    color: palette.muted,
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
    color: palette.text,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.caption,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
