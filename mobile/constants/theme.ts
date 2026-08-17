export const colors = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceSecondary: '#F0F2F5',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  primary: '#2563EB',
  primarySoft: '#EFF6FF',
  primaryDark: '#1D4ED8',
  success: '#059669',
  successSoft: '#ECFDF5',
  warning: '#D97706',
  warningSoft: '#FFFBEB',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  purple: '#7C3AED',
  purpleSoft: '#F5F3FF',
  orange: '#EA580C',
  orangeSoft: '#FFF7ED',
  overlay: 'rgba(15, 23, 42, 0.45)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
  subtitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  largeTitle: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
};

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tab: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
};

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
export const minTouchTarget = 44;
