import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { RmaCard } from '@/components/rma/RmaCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { useCustomerDetail } from '@/hooks/useRmaData';
import { getInitials } from '@/lib/format';
import { recordHref } from '@/lib/routes';

export default function CustomerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customerId = Number(id);
  const { customer, tickets, loading, error, openCount, completedCount } = useCustomerDetail(customerId);

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (error || !customer) {
    return (
      <Screen>
        <AppHeader title="Müşteri Detayı" onBack={() => router.back()} />
        <View style={styles.errorWrap}>
          <Text style={styles.error}>{error || 'Müşteri bulunamadı.'}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Müşteri Detayı" onBack={() => router.back()} />
      <FlatList
        data={tickets}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Card style={styles.profile}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(customer.name)}</Text>
              </View>
              <View style={styles.profileMeta}>
                <Text style={styles.name}>{customer.name || 'Bilinmeyen müşteri'}</Text>
                <Text style={styles.contact}>{customer.phone || '-'}</Text>
                <Text style={styles.contact}>{customer.email || '-'}</Text>
                <Text style={styles.contact}>{customer.address || '-'}</Text>
              </View>
            </Card>

            <View style={styles.statsRow}>
              <StatBox label="Toplam RMA" value={tickets.length} />
              <StatBox label="Açık RMA" value={openCount} />
              <StatBox label="Tamamlanan" value={completedCount} />
            </View>

            <Text style={styles.sectionTitle}>Geçmiş RMA Kayıtları</Text>
          </View>
        }
        renderItem={({ item }) => (
          <RmaCard ticket={item} onPress={() => router.push(recordHref(item.id))} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState title="Bu müşteriye ait RMA kaydı yok" description="Yeni RMA oluşturarak başlayabilirsiniz." />
        }
      />
    </Screen>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <Card style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  header: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  profile: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.subtitle,
    color: colors.primaryDark,
  },
  profileMeta: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.title,
    color: colors.text,
  },
  contact: {
    ...typography.body,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  statValue: {
    ...typography.title,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  separator: {
    height: spacing.md,
  },
  errorWrap: {
    padding: spacing.lg,
  },
  error: {
    color: colors.danger,
  },
});
