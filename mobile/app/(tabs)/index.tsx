import { useCallback, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { QuickAction } from '@/components/dashboard/QuickAction';
import { RecentRmaList } from '@/components/dashboard/RecentRmaCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { colors, radius, spacing } from '@/constants/theme';
import { useDashboard } from '@/hooks/useRmaData';
import { recordHref } from '@/lib/routes';

export default function HomeScreen() {
  const router = useRouter();
  const { tickets, kpis, loading, refreshing, error, refresh } = useDashboard();
  const recentTickets = tickets.slice(0, 5);
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refresh();
    }, [refresh]),
  );

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="RMA Merkezi" subtitle="Canlı Operasyon Merkezi" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.section}>
          <SectionHeader title="Genel Durum" />
          <View style={styles.cardRow}>
            <StatCard
              icon="folder-open-outline"
              value={kpis.openRecords}
              label="Açık Ürünler"
              onPress={() => router.push('/(tabs)/records?view=open')}
            />
            <StatCard
              icon="construct-outline"
              value={kpis.inService}
              label="Serviste"
              tint={colors.purple}
              onPress={() => router.push('/(tabs)/records?status=serviste')}
            />
          </View>
          <View style={styles.cardRow}>
            <StatCard
              icon="swap-horizontal-outline"
              value={kpis.exchangePending}
              label="Değişim Bekleyen"
              tint={colors.orange}
              onPress={() => router.push('/(tabs)/records?category=degisim')}
            />
            <StatCard
              icon="checkmark-circle-outline"
              value={kpis.completed}
              label="Müşteriye Teslim"
              tint={colors.success}
              onPress={() => router.push('/(tabs)/records?status=teslim_edildi')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Hızlı İşlemler" />
          <View style={styles.cardRow}>
            <QuickAction icon="add-circle-outline" label="Yeni RMA" onPress={() => router.push('/(tabs)/new-rma')} />
            <QuickAction icon="business-outline" label="Tedarikçiler" onPress={() => router.push('/(tabs)/suppliers')} />
          </View>
          <View style={styles.cardRow}>
            <QuickAction icon="barcode-outline" label="Koli Tara" onPress={() => router.push('/package/scan')} />
            <QuickAction icon="cube-outline" label="Ürün Listesi" onPress={() => router.push('/(tabs)/products')} />
          </View>
        </View>

        <View style={styles.section}>
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
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxxl + spacing.xl,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});