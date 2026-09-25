import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PRODUCT_STATUSES } from '@/constants/statuses';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

type StatusSheetProps = {
  visible: boolean;
  currentStatus?: string;
  onClose: () => void;
  onSelect: (status: string) => void;
  loading?: boolean;
};

export function StatusSheet({ visible, currentStatus, onClose, onSelect, loading }: StatusSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.handle} />
            <Text style={styles.title}>Durumu Güncelle</Text>
            <View style={styles.list}>
              {PRODUCT_STATUSES.map((status) => {
                const active = status.value === currentStatus;
                return (
                  <Pressable
                    key={status.value}
                    disabled={loading}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => onSelect(status.value)}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {status.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Vazgeç</Text>
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  option: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  optionActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  optionText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  optionTextActive: {
    color: colors.primaryDark,
  },
  cancel: {
    marginTop: spacing.lg,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
});
