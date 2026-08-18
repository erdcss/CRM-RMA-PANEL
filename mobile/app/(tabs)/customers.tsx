import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SearchInput } from '@/components/ui/SearchInput';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useCatalogCustomers } from '@/hooks/useCatalogCustomers';
import { useCustomers } from '@/hooks/useRmaData';
import { getInitials } from '@/lib/format';
import { customerHref } from '@/lib/routes';

type DisplayCustomer = {
  key: string;
  accountCode: string;
  accountName: string;
  phone?: string | null;
  ticketCount?: number;
  rmaCustomerId?: number;
};

export default function CustomersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const {
    customers: catalogCustomers,
    loading: catalogLoading,
    refreshing: catalogRefreshing,
    error: catalogError,
    refresh: refreshCatalog,
  } = useCatalogCustomers(query);

  const {
    customers: rmaCustomers,
    loading: rmaLoading,
    refreshing: rmaRefreshing,
    error: rmaError,
    refresh: refreshRma,
  } = useCustomers();

  const rows = useMemo<DisplayCustomer[]>(() => {
    if (catalogCustomers.length > 0) {
      const rmaByCode = new Map(
        rmaCustomers
          .filter((customer) => customer.accountCode?.trim())
          .map((customer) => [customer.accountCode!.trim(), customer]),
      );

      return catalogCustomers.map((customer) => {
        const linked = rmaByCode.get(customer.accountCode.trim());
        return {
          key: `catalog-${customer.id}`,
          accountCode: customer.accountCode,
          accountName: customer.accountName,
          phone: linked?.phone,
          ticketCount: linked?.ticketCount,
          rmaCustomerId: linked?.id,
        };
      });
    }

    const q = query.trim().toLowerCase();
    return rmaCustomers
      .filter((customer) => {
        if (!q) return true;
        return [customer.accountCode, customer.name, customer.phone, customer.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .map((customer) => ({
        key: `rma-${customer.id}`,
        accountCode: customer.accountCode || '-',
        accountName: customer.name || 'Bilinmeyen müşteri',
        phone: customer.phone,
        ticketCount: customer.ticketCount,
        rmaCustomerId: customer.id,
      }));
  }, [catalogCustomers, rmaCustomers, query]);

  const loading = catalogLoading && rmaLoading;
  const refreshing = catalogRefreshing || rmaRefreshing;
  const error = catalogError ?? rmaError;

  const refresh = useCallback(() => {
    void Promise.all([refreshCatalog(), refreshRma()]);
  }, [refreshCatalog, refreshRma]);

  if (loading && rows.length === 0) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Müşteriler" subtitle={`${rows.length} müşteri`} />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <SearchInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cari kodu veya cari adı ara"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => {
          const canOpen = Boolean(item.rmaCustomerId);
          return (
            <Pressable
              style={styles.row}
              disabled={!canOpen}
              onPress={() => item.rmaCustomerId && router.push(customerHref(item.rmaCustomerId))}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(item.accountName)}</Text>
              </View>
              <View style={styles.meta}>
                <Text style={styles.name}>{item.accountName}</Text>
                <Text style={styles.code}>Cari Kodu: {item.accountCode}</Text>
                {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}
                {typeof item.ticketCount === 'number' ? (
                  <Text style={styles.count}>{item.ticketCount} RMA Kaydı</Text>
                ) : null}
              </View>
              {canOpen ? <Text style={styles.chevron}>›</Text> : null}
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Müşteri bulunamadı"
            description="Bu hesaba ait cari listesinde eşleşen kayıt bulunamadı."
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
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.subtitle,
    color: colors.text,
  },
  code: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  phone: {
    ...typography.body,
    color: colors.textSecondary,
  },
  count: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 24,
    color: colors.textMuted,
  },
  separator: {
    height: spacing.md,
  },
  error: {
    color: colors.danger,
  },
});
