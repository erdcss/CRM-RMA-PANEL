import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SearchInput } from '@/components/ui/SearchInput';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useCustomers, useTickets } from '@/hooks/useRmaData';
import { getInitials } from '@/lib/format';
import { customerHref } from '@/lib/routes';
import type { RmaCustomer } from '@/lib/api';

export default function CustomersScreen() {
  const router = useRouter();
  const {
    customers,
    loading: customersLoading,
    refreshing: customersRefreshing,
    error: customersError,
    refresh: refreshCustomers,
  } = useCustomers();
  const {
    tickets,
    loading: ticketsLoading,
    refreshing: ticketsRefreshing,
    error: ticketsError,
    refresh: refreshTickets,
  } = useTickets();
  const [query, setQuery] = useState('');

  const customerRows = useMemo<RmaCustomer[]>(() => {
    if (customers.length > 0) return customers;

    const fallback = new Map<number, RmaCustomer>();
    for (const ticket of tickets) {
      const existing = fallback.get(ticket.customer.id);
      if (existing) {
        existing.ticketCount = (existing.ticketCount ?? 0) + 1;
        continue;
      }

      fallback.set(ticket.customer.id, {
        id: ticket.customer.id,
        name: ticket.customer.name,
        phone: ticket.customer.phone,
        email: ticket.customer.email,
        address: ticket.customer.address,
        ticketCount: 1,
      });
    }

    return Array.from(fallback.values());
  }, [customers, tickets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customerRows;
    return customerRows.filter((customer) =>
      [customer.name, customer.phone, customer.email].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [customerRows, query]);

  const loading = customersLoading && ticketsLoading;
  const refreshing = customersRefreshing || ticketsRefreshing;
  const error = customersError ?? ticketsError;

  const refresh = useCallback(() => {
    void Promise.all([refreshCustomers(), refreshTickets()]);
  }, [refreshCustomers, refreshTickets]);

  if (loading && customerRows.length === 0) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Müşteriler" subtitle={`${customerRows.length} müşteri`} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <SearchInput
              value={query}
              onChangeText={setQuery}
              placeholder="Ad, telefon veya e-posta ara"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(customerHref(item.id))}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.name}>{item.name || 'Bilinmeyen müşteri'}</Text>
              <Text style={styles.phone}>{item.phone || '-'}</Text>
              <Text style={styles.count}>{item.ticketCount ?? 0} RMA Kaydı</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Müşteri bulunamadı"
            description="Henüz bu hesaba ait müşteri veya RMA kaydı bulunmuyor."
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
