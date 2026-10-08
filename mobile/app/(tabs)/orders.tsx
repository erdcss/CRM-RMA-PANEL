import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  getOrderList,
  orderListItemTotal,
  orderListItemUnits,
  removeFromOrderList,
  subscribeOrderList,
  updateOrderListQuantity,
  type B2BOrderListItem,
} from '@/lib/b2b-order-list';

function money(value: number) {
  return `${Number(value || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

export default function OrderListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<B2BOrderListItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const drawer = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setItems(await getOrderList());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const unsubscribe = subscribeOrderList(() => void load());
      return unsubscribe;
    }, [load]),
  );

  const totals = useMemo(() => {
    return items.reduce(
      (result, item) => {
        result.boxes += item.boxQuantity;
        result.units += orderListItemUnits(item);
        result.amount += orderListItemTotal(item);
        return result;
      },
      { boxes: 0, units: 0, amount: 0 },
    );
  }, [items]);

  const toggleDrawer = () => {
    const next = !expanded;
    setExpanded(next);
    Animated.timing(drawer, {
      toValue: next ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const detailsHeight = drawer.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 170],
  });

  const detailsOpacity = drawer.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <Screen>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>B2B SİPARİŞ</Text>
            <Text style={styles.title}>Sipariş Listesi</Text>
            <Text style={styles.subtitle}>
              Siparişe eklediğiniz ürünleri koli bazında kontrol edin.
            </Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{items.length}</Text>
          </View>
        </View>

        {items.length ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            {items.map((item) => {
              const units = orderListItemUnits(item);
              const total = orderListItemTotal(item);
              const maxBoxes = Math.max(
                item.minOrderQty,
                Math.floor(item.stock / Math.max(1, item.unitsPerBox)),
              );

              return (
                <View key={item.productId} style={styles.itemCard}>
                  <Pressable
                    style={styles.imageWrap}
                    onPress={() =>
                      router.push({
                        pathname: '/product/[id]',
                        params: { id: item.productId },
                      } as never)
                    }
                  >
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        style={styles.image}
                        contentFit="contain"
                      />
                    ) : (
                      <Ionicons
                        name="cube-outline"
                        size={34}
                        color={colors.textMuted}
                      />
                    )}
                  </Pressable>

                  <View style={styles.itemMiddle}>
                    <Text style={styles.sku}>{item.sku || 'STOK'}</Text>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {item.boxQuantity} koli · Koli içi {item.unitsPerBox} adet
                    </Text>

                    <View style={styles.quantityRow}>
                      <Pressable
                        style={styles.quantityButton}
                        disabled={item.boxQuantity <= item.minOrderQty}
                        onPress={async () => {
                          await updateOrderListQuantity(
                            item.productId,
                            item.boxQuantity - 1,
                          );
                        }}
                      >
                        <Ionicons
                          name="remove"
                          size={17}
                          color={
                            item.boxQuantity <= item.minOrderQty
                              ? colors.textMuted
                              : colors.text
                          }
                        />
                      </Pressable>
                      <Text style={styles.quantityText}>{item.boxQuantity}</Text>
                      <Pressable
                        style={styles.quantityButton}
                        disabled={item.boxQuantity >= maxBoxes}
                        onPress={async () => {
                          await updateOrderListQuantity(
                            item.productId,
                            item.boxQuantity + 1,
                          );
                        }}
                      >
                        <Ionicons
                          name="add"
                          size={17}
                          color={
                            item.boxQuantity >= maxBoxes
                              ? colors.textMuted
                              : colors.text
                          }
                        />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.itemRight}>
                    <Pressable
                      style={styles.removeButton}
                      onPress={async () => {
                        await removeFromOrderList(item.productId);
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={17}
                        color={colors.textMuted}
                      />
                    </Pressable>

                    <View style={styles.itemAmount}>
                      <Text style={styles.units}>{units} adet</Text>
                      <Text style={styles.total}>{money(total)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="list-outline" size={34} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Sipariş listeniz boş</Text>
            <Text style={styles.emptyText}>
              Ürün detayından koli adedini seçip “Siparişlere Ekle” butonuna dokunun.
            </Text>
            <Pressable
              style={styles.browseButton}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.browseButtonText}>Ürünleri İncele</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.drawer}>
          <Pressable style={styles.drawerHeader} onPress={toggleDrawer}>
            <View>
              <Text style={styles.drawerLabel}>Genel Toplam</Text>
              <Text style={styles.drawerTotal}>{money(totals.amount)}</Text>
            </View>
            <View style={styles.drawerToggle}>
              <Text style={styles.drawerToggleText}>
                {expanded ? 'Detayı Gizle' : 'Detayı Gör'}
              </Text>
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: drawer.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '180deg'],
                      }),
                    },
                  ],
                }}
              >
                <Ionicons
                  name="chevron-up"
                  size={20}
                  color={colors.text}
                />
              </Animated.View>
            </View>
          </Pressable>

          <Animated.View
            style={[
              styles.drawerDetails,
              {
                maxHeight: detailsHeight,
                opacity: detailsOpacity,
              },
            ]}
          >
            <View style={styles.detailLine}>
              <Text style={styles.detailLabel}>Ürün çeşidi</Text>
              <Text style={styles.detailValue}>{items.length}</Text>
            </View>
            <View style={styles.detailLine}>
              <Text style={styles.detailLabel}>Toplam koli</Text>
              <Text style={styles.detailValue}>{totals.boxes}</Text>
            </View>
            <View style={styles.detailLine}>
              <Text style={styles.detailLabel}>Toplam ürün adedi</Text>
              <Text style={styles.detailValue}>{totals.units}</Text>
            </View>
            <View style={[styles.detailLine, styles.detailLineLast]}>
              <Text style={styles.detailTotalLabel}>Sipariş tutarı</Text>
              <Text style={styles.detailTotalValue}>{money(totals.amount)}</Text>
            </View>
          </Animated.View>

          {items.length ? (
            <Pressable
              style={styles.checkoutButton}
              onPress={() =>
                router.push({
                  pathname: '/checkout',
                  params: { list: '1' },
                } as never)
              }
            >
              <Ionicons name="bag-check-outline" size={19} color="#FFFFFF" />
              <Text style={styles.checkoutButtonText}>Siparişi Tamamla</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '800',
    letterSpacing: 1.2,
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
    maxWidth: 310,
  },
  countBadge: {
    minWidth: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 330,
    gap: spacing.sm,
  },
  itemCard: {
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    flexDirection: 'row',
    gap: spacing.md,
  },
  imageWrap: {
    width: 82,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  itemMiddle: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 2,
  },
  sku: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  itemTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '800',
    marginTop: 2,
  },
  itemMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  quantityRow: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  quantityButton: {
    width: 32,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    minWidth: 34,
    textAlign: 'center',
    ...typography.caption,
    color: colors.text,
    fontWeight: '900',
  },
  itemRight: {
    width: 94,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemAmount: {
    alignItems: 'flex-end',
  },
  units: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  total: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '900',
    marginTop: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: 250,
  },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    fontWeight: '900',
    marginTop: spacing.lg,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  browseButton: {
    minHeight: 48,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: '#111827',
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  drawer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.98)',
    padding: spacing.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 14,
  },
  drawerHeader: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  drawerLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  drawerTotal: {
    ...typography.title,
    color: colors.text,
    fontWeight: '900',
    marginTop: 2,
  },
  drawerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  drawerToggleText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  drawerDetails: {
    overflow: 'hidden',
  },
  detailLine: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  detailLineLast: {
    minHeight: 46,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '800',
  },
  detailTotalLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '900',
  },
  detailTotalValue: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '900',
  },
  checkoutButton: {
    minHeight: 52,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  checkoutButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '900',
  },
});
