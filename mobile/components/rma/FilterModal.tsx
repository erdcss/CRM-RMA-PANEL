import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterChip } from '@/components/ui/FilterChip';
import { CATEGORY_OPTIONS, FILTER_CHIPS } from '@/constants/statuses';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

export type RecordFilters = {
  status: string;
  category: string;
};

type FilterModalProps = {
  visible: boolean;
  filters: RecordFilters;
  onClose: () => void;
  onChange: (filters: RecordFilters) => void;
};

export function FilterModal({ visible, filters, onClose, onChange }: FilterModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.handle} />
            <Text style={styles.title}>Filtre</Text>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.section}>Durum</Text>
              <View style={styles.chips}>
                {FILTER_CHIPS.map((chip) => (
                  <FilterChip
                    key={chip.id}
                    label={chip.label}
                    active={filters.status === chip.id}
                    onPress={() => onChange({ ...filters, status: chip.id })}
                  />
                ))}
              </View>

              <Text style={styles.section}>İşlem Türü</Text>
              <View style={styles.chips}>
                <FilterChip
                  label="Tümü"
                  active={filters.category === 'all'}
                  onPress={() => onChange({ ...filters, category: 'all' })}
                />
                {CATEGORY_OPTIONS.map((category) => (
                  <FilterChip
                    key={category.value}
                    label={category.label}
                    active={filters.category === category.value}
                    onPress={() => onChange({ ...filters, category: category.value })}
                  />
                ))}
              </View>
            </ScrollView>
            <Pressable style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Uygula</Text>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '78%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.md,
  },
  content: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  section: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  button: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: colors.surface,
  },
});
