import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

type FormFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  rightSlot?: React.ReactNode;
  compact?: boolean;
  appearance?: 'default' | 'dark';
};

export function FormField({ label, hint, rightSlot, compact, appearance = 'default', style, ...props }: FormFieldProps) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.label, compact && styles.labelCompact, appearance === 'dark' && styles.darkLabel]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          {...props}
          placeholderTextColor={appearance === 'dark' ? '#9CA3AF' : colors.textMuted}
          style={[styles.input, compact && styles.inputCompact, appearance === 'dark' && styles.darkInput, style, rightSlot ? styles.inputWithSlot : null]}
        />
        {rightSlot}
      </View>
      {hint ? <Text style={[styles.hint, appearance === 'dark' && styles.darkHint]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  darkLabel: { color: '#F5F5F5', fontWeight: '600' },
  darkInput: { backgroundColor: '#1B1B1B', borderColor: '#525252', color: '#FFFFFF' },
  darkHint: { color: '#BDBDBD' },
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
