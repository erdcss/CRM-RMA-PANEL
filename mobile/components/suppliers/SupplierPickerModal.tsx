import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchInput } from '@/components/ui/SearchInput';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useCatalogCustomers } from '@/hooks/useRmaData';
import type { CatalogCustomer } from '@/lib/api';

type SupplierPickerModalProps = {
  visible: boolean;
  title?: string;
  selectedAccountCode?: string | null;
  onClose: () => void;
  onSelect: (customer: CatalogCustomer) => void;
};

function useDebouncedValue(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

export function SupplierPickerModal({
  visible,
  title = 'Tedarikçi Cari Seç',
  selectedAccountCode,
  onClose,
  onSelect,
}: SupplierPickerModalProps) {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query);
  const { customers, loading, error } = useCatalogCustomers(debounced);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Kayıtlı cari listesinden tedarikçi seçin</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.search}>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cari kodu veya firma adı ara"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <FlatList
          data={customers}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{loading ? 'Cari listesi yükleniyor…' : 'Eşleşen cari bulunamadı.'}</Text>
          }
          renderItem={({ item }) => {
            const active = selectedAccountCode === item.accountCode;
            return (
              <Pressable
                style={[styles.item, active && styles.itemActive]}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <View style={styles.itemIcon}>
                  <Ionicons name="business-outline" size={20} color={active ? colors.primaryDark : colors.textSecondary} />
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemName}>{item.accountName}</Text>
                  <Text style={styles.itemCode}>Cari Kodu: {item.accountCode}</Text>
                </View>
                {active ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.sm,
    flexGrow: 1,
  },
  item: {
    minHeight: 68,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  itemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  itemCode: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xxxl,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
  },
});
