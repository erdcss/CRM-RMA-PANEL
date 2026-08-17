import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ProductDetailCard } from '@/components/rma/ProductDetailCard';
import { AttachmentsSection } from '@/components/rma/AttachmentCard';
import { StatusSheet } from '@/components/rma/StatusSheet';
import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useTicket } from '@/hooks/useRmaData';
import { rmaApi, type RmaProduct } from '@/lib/api';
import { formatDateTime, formatRmaId } from '@/lib/format';
import { shareTicketPdf } from '@/lib/pdf';

export default function RecordDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = Number(id);
  const { ticket, loading, error, reload } = useTicket(ticketId);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<RmaProduct | null>(null);
  const [updating, setUpdating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = () => {
    if (!ticket) return;
    Alert.alert(
      'Kaydı Sil',
      `${formatRmaId(ticket)} kaydını kalıcı olarak silmek istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: handleDelete },
      ],
    );
  };

  const handleDelete = async () => {
    if (!ticket) return;
    setDeleting(true);
    try {
      await rmaApi.deleteTicket(ticket.id);
      router.replace('/(tabs)/records');
    } catch (err) {
      Alert.alert('Kayıt silinemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setDeleting(false);
    }
  };

  const openStatusSheet = (product: RmaProduct) => {
    setSelectedProduct(product);
    setStatusOpen(true);
  };

  const handleStatusUpdate = async (status: string) => {
    if (!selectedProduct) return;
    setUpdating(true);
    try {
      await rmaApi.updateProductStatus(selectedProduct.id, status);
      setStatusOpen(false);
      setSelectedProduct(null);
      await reload();
    } catch (err) {
      Alert.alert('Durum güncellenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setUpdating(false);
    }
  };

  const handlePdf = async () => {
    if (!ticket) return;
    setSharing(true);
    try {
      await shareTicketPdf(ticket);
    } catch (err) {
      Alert.alert('PDF oluşturulamadı', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setSharing(false);
    }
  };

  const handleShare = async () => {
    if (!ticket) return;
    await Share.share({
      message: `${formatRmaId(ticket)} - ${ticket.customer.name ?? 'Müşteri'} RMA kaydı`,
    });
  };

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (error || !ticket) {
    return (
      <Screen>
        <AppHeader title="RMA Detayı" onBack={() => router.back()} />
        <View style={styles.errorWrap}>
          <Text style={styles.error}>{error || 'Kayıt bulunamadı.'}</Text>
        </View>
      </Screen>
    );
  }

  const openProducts = ticket.products.filter((p) => !['teslim_edildi', 'iptal'].includes(p.status));

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader
        title={formatRmaId(ticket)}
        onBack={() => router.back()}
        rightSlot={
          <Pressable style={styles.menuButton} onPress={confirmDelete} disabled={deleting}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.summary}>
          <SummaryItem label="Müşteri" value={ticket.customer.name || '-'} />
          <SummaryItem label="Ürün sayısı" value={String(ticket.products.length)} />
          <SummaryItem label="Açık ürün" value={String(openProducts.length)} />
          <SummaryItem label="Oluşturulma" value={formatDateTime(ticket.createdAt)} />
        </Card>

        <Section title="MÜŞTERİ BİLGİLERİ">
          <InfoRow label="Ad Soyad / Firma" value={ticket.customer.name || '-'} />
          <InfoRow label="Telefon" value={ticket.customer.phone || '-'} />
          <InfoRow label="E-posta" value={ticket.customer.email || '-'} />
          <InfoRow label="Adres" value={ticket.customer.address || '-'} />
        </Section>

        {ticket.products.map((product, index) => (
          <ProductDetailCard
            key={product.id}
            product={product}
            index={index}
            onUpdateStatus={() => openStatusSheet(product)}
          />
        ))}

        <AttachmentsSection />

        <Pressable
          style={[styles.deleteButton, deleting && styles.actionDisabled]}
          onPress={confirmDelete}
          disabled={deleting}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={styles.deleteButtonText}>{deleting ? 'Siliniyor…' : 'Kaydı Sil'}</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.actions}>
        <ActionButton label={sharing ? 'PDF…' : 'PDF Oluştur'} onPress={handlePdf} disabled={sharing} />
        <ActionButton label="Paylaş" onPress={handleShare} />
      </View>

      <StatusSheet
        visible={statusOpen}
        currentStatus={selectedProduct?.status}
        loading={updating}
        onClose={() => {
          setStatusOpen(false);
          setSelectedProduct(null);
        }}
        onSelect={handleStatusUpdate}
      />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card style={styles.sectionCard}>{children}</Card>
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable style={[styles.actionButton, disabled && styles.actionDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  summary: {
    gap: spacing.md,
  },
  summaryItem: {
    gap: 2,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  summaryValue: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  sectionCard: {
    gap: spacing.md,
  },
  infoRow: {
    gap: 2,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
  },
  menuButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  actionButton: {
    flex: 1,
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionText: {
    ...typography.bodyMedium,
    color: colors.surface,
    fontWeight: '700',
  },
  errorWrap: {
    padding: spacing.lg,
  },
  error: {
    color: colors.danger,
  },
  deleteButton: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  deleteButtonText: {
    ...typography.bodyMedium,
    color: colors.danger,
  },
});
