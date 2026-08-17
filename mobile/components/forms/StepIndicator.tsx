import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

const STEPS = ['Müşteri', 'Ürünler', 'Onay'];

type StepIndicatorProps = {
  currentStep: number;
};

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const stepNumber = index + 1;
        const active = stepNumber === currentStep;
        const completed = stepNumber < currentStep;
        return (
          <View key={step} style={styles.item}>
            <View style={[styles.circle, (active || completed) && styles.circleActive]}>
              <Text style={[styles.circleText, (active || completed) && styles.circleTextActive]}>
                {stepNumber}
              </Text>
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{step}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  circleText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  circleTextActive: {
    color: colors.surface,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  labelActive: {
    color: colors.text,
    fontWeight: '600',
  },
});
