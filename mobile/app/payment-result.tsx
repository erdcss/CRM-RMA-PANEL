import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';

export default function PaymentResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    result?: string;
    order?: string;
    stock?: string;
    method?: string;
  }>();

  const success = params.result === 'success';
  const bankTransfer = params.method === 'bank_transfer';

  return (
    <Screen>
      <View style={styles.page}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: success ? colors.success : colors.danger },
          ]}
        >
          <Ionicons
            name={success ? 'checkmark' : 'close'}
            size={42}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.title}>
          {success
            ? bankTransfer
              ? 'Havale bildiriminiz alındı'
              : 'Ödemeniz başarıyla tamamlandı'
            : 'Ödeme tamamlanamadı'}
        </Text>

        <Text style={styles.subtitle}>
          {success
            ? bankTransfer
              ? 'Ödemeniz kontrol edildikten sonra sipariş durumunuz güncellenecektir.'
              : params.stock === 'review'
                ? 'Ödemeniz alındı. Stok kontrolü gereken bir ürün bulundu; ekibimiz siparişinizi inceleyecek.'
                : 'Siparişiniz oluşturuldu ve ödeme onayı alındı.'
            : 'Kart işlemi tamamlanmadı. Siparişinizi yeniden deneyebilir veya Havale/EFT yöntemini kullanabilirsiniz.'}
        </Text>

        {params.order ? (
          <View style={styles.orderBox}>
            <Text style={styles.orderLabel}>Sipariş Numarası</Text>
            <Text style={styles.orderNumber}>{params.order}</Text>
          </View>
        ) : null}

        <Pressable style={styles.primaryButton} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="home-outline" size={19} color="#FFFFFF" />
          <Text style={styles.primaryText}>Ana Sayfaya Dön</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.replace('/(tabs)/profile')}
        >
          <Ionicons name="person-outline" size={19} color={colors.text} />
          <Text style={styles.secondaryText}>Hesabımı Aç</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.largeTitle,
    color: colors.text,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  orderBox: {
    width: '100%',
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    alignItems: 'center',
  },
  orderLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  orderNumber: {
    ...typography.title,
    color: colors.text,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  primaryButton: {
    width: '100%',
    minHeight: 52,
    marginTop: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 52,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondaryText: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '800',
  },
});
