import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

type FormFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  rightSlot?: React.ReactNode;
  compact?: boolean;
};

export function FormField({ label, hint, rightSlot, compact, style, ...props }: FormFieldProps) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          {...props}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, compact && styles.inputCompact, style, rightSlot ? styles.inputWithSlot : null]}
        />
        {rightSlot}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  wrapCompact: {
    gap: spacing.xs,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  labelCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  inputRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.text,
  },
  inputCompact: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    lineHeight: 18,
  },
  inputWithSlot: {
    paddingRight: 48,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
