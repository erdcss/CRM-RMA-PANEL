import { StyleSheet, Text, View } from 'react-native';

import { getStatusLabel } from '@/constants/statuses';
import { colors, spacing, typography } from '@/constants/theme';
import type { StatusHistoryEntry } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

type RmaTimelineProps = {
  history: StatusHistoryEntry[];
};

export function RmaTimeline({ history }: RmaTimelineProps) {
  if (!history.length) {
    return <Text style={styles.empty}>Durum geçmişi bulunmuyor.</Text>;
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <View style={styles.container}>
      {sorted.map((entry, index) => {
        const isLast = index === sorted.length - 1;
        return (
          <View key={entry.id} style={styles.item}>
            <View style={styles.lineWrap}>
              <View style={[styles.dot, isLast && styles.dotPending]} />
              {!isLast ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>{getStatusLabel(entry.status)}</Text>
              {entry.notes ? <Text style={styles.notes}>{entry.notes}</Text> : null}
              <Text style={styles.date}>{formatDateTime(entry.createdAt)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  lineWrap: {
    alignItems: 'center',
    width: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  dotPending: {
    backgroundColor: colors.border,
    borderWidth: 2,
    borderColor: colors.textMuted,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: 4,
    minHeight: 36,
  },
  content: {
    flex: 1,
    gap: 2,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  notes: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
