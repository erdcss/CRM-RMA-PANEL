import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FilterModal, type RecordFilters } from '@/components/rma/FilterModal';
import { RmaCard } from '@/components/rma/RmaCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SearchInput } from '@/components/ui/SearchInput';
import { FILTER_CHIPS } from '@/constants/statuses';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useTickets } from '@/hooks/useRmaData';
import { formatRmaId } from '@/lib/format';
import { recordHref } from '@/lib/routes';

function matchesTicket(
  ticket: {
    id: number;
    receiptNumber?: string | null;
    customer: { name: string | null; phone: string | null };
    products: Array<{ serialNumber?: string | null; category: string; status: string }>;
  },
  query: string,
  filters: RecordFilters,
  view?: string,
) {
  const q = query.trim().toLowerCase();
  const haystack = [
    formatRmaId(ticket),
    ticket.customer.name,
    ticket.customer.phone,
    ...ticket.products.map((p) => p.serialNumber),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (q && !haystack.includes(q)) return false;

  if (view === 'open') {
    if (!ticket.products.some((product) => !['teslim_edildi', 'iptal'].includes(product.status))) return false;
  }

  if (filters.status !== 'all') {
    const statusMatch =
      filters.status === 'degisim' || filters.status === 'iade'
        ? ticket.products.some((p) => p.category === filters.status)
        : ticket.products.some((p) => p.status === filters.status);
    if (!statusMatch) return false;
  }

  if (filters.category !== 'all') {
    if (!ticket.products.some((p) => p.category === filters.category)) return false;
  }

  return true;
}

export default function RecordsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string; category?: string; view?: string }>();
  const { tickets, loading, refreshing, error, refresh } = useTickets();
  const [query, setQuery] = useState('');
  const [activeChip, setActiveChip] = useState('all');
  const [filters, setFilters] = useState<RecordFilters>({ status: 'all', category: 'all' });
  const [activeView, setActiveView] = useState<string | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);
  const isFirstFocus = useRef(true);

  useEffect(() => {
    const status = typeof params.status === 'string' ? params.status : 'all';
    const category = typeof params.category === 'string' ? params.category : 'all';
    setActiveChip(status);
    setFilters((current) => ({ ...current, status, category }));
    setActiveView(typeof params.view === 'string' ? params.view : undefined);
  }, [params.category, params.status, params.view]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      refresh();
    }, [refresh]),
  );

  const filtered = useMemo(
    () =>
      tickets.filter((ticket) =>
        matchesTicket(
          ticket,
          query,
          {
            status: activeChip,
            category: filters.category,
          },
          activeView,
        ),
      ),
    [tickets, query, activeChip, filters.category, activeView],
  );

  const setChip = (chip: string) => {
    setActiveView(undefined);
    setActiveChip(chip);
    setFilters((current) => ({ ...current, status: chip }));
  };

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="RMA Kayıtları" />
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.searchRow}>
              <View style={styles.searchWrap}>
                <SearchInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="RMA no, müşteri, telefon, seri no ara"
                />
              </View>
              <Pressable style={styles.filterButton} onPress={() => setFilterOpen(true)}>
                <Text style={styles.filterText}>Filtre</Text>
              </Pressable>
            </View>

            {activeView === 'open' ? (
              <Pressable style={styles.activeView} onPress={() => setActiveView(undefined)}>
                <Text style={styles.activeViewText}>Açık ürünler gösteriliyor · Temizle</Text>
              </Pressable>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTER_CHIPS.map((chip) => (
                <FilterChip
                  key={chip.id}
                  label={chip.label}
                  active={activeChip === chip.id && !activeView}
                  onPress={() => setChip(chip.id)}
                />
              ))}
            </ScrollView>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <RmaCard ticket={item} onPress={() => router.push(recordHref(item.id))} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="Kayıt bulunamadı"
            description="Seçili filtrelerde gerçek RMA kaydı bulunmuyor."
            actionLabel="Yeni RMA Oluştur"
            onAction={() => router.push('/(tabs)/new-rma')}
          />
        }
      />

      <FilterModal
        visible={filterOpen}
        filters={filters}
        onClose={() => setFilterOpen(false)}
        onChange={(next) => {
          setActiveView(undefined);
          setFilters(next);
          setActiveChip(next.status);
        }}
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
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  searchWrap: {
    flex: 1,
  },
  filterButton: {
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  activeView: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  activeViewText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  chips: {
    paddingRight: spacing.lg,
  },
  separator: {
    height: spacing.md,
  },
  error: {
    color: colors.danger,
  },
});
