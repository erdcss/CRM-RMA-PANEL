import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

type FormFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  rightSlot?: React.ReactNode;
};

export function FormField({ label, hint, rightSlot, style, ...props }: FormFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          {...props}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style, rightSlot ? styles.inputWithSlot : null]}
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
  label: {
    ...typography.bodyMedium,
    color: colors.text,
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
  inputWithSlot: {
    paddingRight: 48,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
