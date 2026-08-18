import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SearchInput } from '@/components/ui/SearchInput';
import { colors, spacing, typography } from '@/constants/theme';
import { useCatalogProducts, useTickets } from '@/hooks/useRmaData';

type DisplayProduct = {
  key: string;
  stockCode: string;
  stockName: string;
};

export default function ProductsScreen() {
  const [query, setQuery] = useState('');
  const {
    products: catalogProducts,
    loading: catalogLoading,
    refreshing: catalogRefreshing,
    error: catalogError,
    refresh: refreshCatalog,
  } = useCatalogProducts(query);
  const {
    tickets,
    loading: ticketsLoading,
    refreshing: ticketsRefreshing,
    error: ticketsError,
    refresh: refreshTickets,
  } = useTickets();

  const products = useMemo<DisplayProduct[]>(() => {
    if (catalogProducts.length > 0) {
      return catalogProducts.map((item) => ({
        key: `catalog-${item.id}`,
        stockCode: item.stockCode,
        stockName: item.stockName,
      }));
    }

    const q = query.trim().toLowerCase();
    const unique = new Map<string, DisplayProduct>();

    for (const ticket of tickets) {
      for (const product of ticket.products) {
        const stockCode = product.stockCode?.trim() || '';
        const stockName = product.name?.trim() || '';
        if (!stockCode && !stockName) continue;

        const searchable = `${stockCode} ${stockName}`.toLowerCase();
        if (q && !searchable.includes(q)) continue;

        const dedupeKey = `${stockCode.toLowerCase()}|${stockName.toLowerCase()}`;
        if (!unique.has(dedupeKey)) {
          unique.set(dedupeKey, {
            key: `rma-${dedupeKey}`,
            stockCode: stockCode || '-',
            stockName: stockName || 'Bilinmeyen ürün',
          });
        }
      }
    }

    return Array.from(unique.values());
  }, [catalogProducts, tickets, query]);

  const loading = catalogLoading && ticketsLoading;
  const refreshing = catalogRefreshing || ticketsRefreshing;
  const error = catalogError ?? ticketsError;

  const refresh = useCallback(() => {
    void Promise.all([refreshCatalog(), refreshTickets()]);
  }, [refreshCatalog, refreshTickets]);

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
        keyExtractor={(item) => item.key}
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
            description="Ürün kataloğu ve mevcut RMA ürünlerinde eşleşen kayıt bulunamadı."
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
