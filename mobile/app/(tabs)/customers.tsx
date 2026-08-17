import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SearchInput } from '@/components/ui/SearchInput';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useCustomers } from '@/hooks/useRmaData';
import { getInitials } from '@/lib/format';
import { customerHref } from '@/lib/routes';

export default function CustomersScreen() {
  const router = useRouter();
  const { customers, loading, refreshing, error, refresh } = useCustomers();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.email].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [customers, query]);

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Müşteriler" />
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
            description="Yeni RMA oluştururken müşteri kaydı eklenebilir."
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
