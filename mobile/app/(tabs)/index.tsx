import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { QuickAction } from '@/components/dashboard/QuickAction';
import { RecentRmaList } from '@/components/dashboard/RecentRmaCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { colors, spacing } from '@/constants/theme';
import { useDashboard } from '@/hooks/useRmaData';
import { recordHref } from '@/lib/routes';

export default function HomeScreen() {
  const router = useRouter();
  const { tickets, kpis, loading, refreshing, error, refresh } = useDashboard();
  const recentTickets = tickets.slice(0, 5);

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="RMA Merkezi" subtitle="Operasyon Merkezi" showActions notificationCount={0} avatarLabel="RMA" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <SectionHeader title="Genel Durum" />
        <View style={styles.statsGrid}>
          <StatCard icon="folder-open-outline" value={kpis.openRecords} label="Açık Kayıtlar" />
          <StatCard icon="construct-outline" value={kpis.inService} label="Serviste" tint={colors.purple} />
          <StatCard icon="swap-horizontal-outline" value={kpis.exchangePending} label="Değişim Bekleyen" tint={colors.orange} />
          <StatCard icon="checkmark-circle-outline" value={kpis.completed} label="Tamamlanan" tint={colors.success} />
        </View>

        <SectionHeader title="Hızlı İşlemler" />
        <View style={styles.quickActions}>
          <QuickAction icon="add-circle-outline" label="Yeni RMA" onPress={() => router.push('/(tabs)/new-rma')} />
          <QuickAction icon="barcode-outline" label="Barkod / Seri No Ara" disabled badge="Yakında" />
          <QuickAction icon="search-outline" label="Müşteri Bul" onPress={() => router.push('/(tabs)/customers')} />
          <QuickAction icon="document-outline" label="PDF / Evraklar" disabled badge="Yakında" />
        </View>

        <SectionHeader
          title="Son Kayıtlar"
          actionLabel="Tümünü Gör"
          onAction={() => router.push('/(tabs)/records')}
        />

        {recentTickets.length === 0 ? (
          <EmptyState
            title="Henüz RMA kaydı yok"
            description="İlk RMA kaydınızı oluşturarak başlayın."
            actionLabel="Yeni RMA Oluştur"
            onAction={() => router.push('/(tabs)/new-rma')}
          />
        ) : (
          <RecentRmaList tickets={recentTickets} onPressTicket={(id) => router.push(recordHref(id))} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
  },
});
