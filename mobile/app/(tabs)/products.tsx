import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SearchInput } from '@/components/ui/SearchInput';
import { colors, spacing, typography } from '@/constants/theme';
import { useCatalogProducts } from '@/hooks/useRmaData';

export default function ProductsScreen() {
  const [query, setQuery] = useState('');
  const { products, loading, refreshing, error, refresh } = useCatalogProducts(query);

  const subtitle = useMemo(() => {
    if (loading) return 'Yükleniyor…';
    return `${products.length} ürün`;
  }, [loading, products.length]);

  if (loading && products.length === 0) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Ürünler" subtitle={subtitle} />
      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <SearchInput
              value={query}
              onChangeText={setQuery}
              placeholder="Stok kodu veya ürün adı ara"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.codeCol}>
              <Text style={styles.codeLabel}>Stok Kodu</Text>
              <Text style={styles.codeValue}>{item.stockCode}</Text>
            </View>
            <View style={styles.nameCol}>
              <Text style={styles.nameLabel}>Stok Adı</Text>
              <Text style={styles.nameValue}>{item.stockName}</Text>
            </View>
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title="Ürün bulunamadı"
            description="Stok listeniz boş veya arama sonucu yok."
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  header: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  codeCol: {
    width: 110,
    gap: 2,
  },
  nameCol: {
    flex: 1,
    gap: 2,
  },
  codeLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  codeValue: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  nameLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  nameValue: {
    ...typography.body,
    color: colors.text,
  },
  separator: {
    height: spacing.sm,
  },
  error: {
    color: colors.danger,
  },
});
