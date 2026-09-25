import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '@/lib/appAlert';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ProductDetailCard } from '@/components/rma/ProductDetailCard';
import { StatusSheet } from '@/components/rma/StatusSheet';
import { AppHeader } from '@/components/ui/AppHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { useTicket } from '@/hooks/useRmaData';
import { useTicketProductPhotos } from '@/hooks/useProductPhotos';
import { rmaApi } from '@/lib/api';
import { getAttachmentSignedUrl, uploadProductPhoto } from '@/lib/attachments';
import { formatRmaId } from '@/lib/format';

export default function RecordProductDetailScreen() {
  const router = useRouter();
  const { id, productId } = useLocalSearchParams<{ id: string; productId: string }>();
  const ticketId = Number(id);
  const pid = Number(productId);
  const { ticket, loading, error, reload } = useTicket(ticketId);
  const { getProductPhotoUrl, setProductPhotoUrl } = useTicketProductPhotos(ticketId);
  const [statusOpen, setStatusOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const product = useMemo(
    () => ticket?.products.find((row) => row.id === pid) ?? null,
    [ticket, pid],
  );

  const productIndex = useMemo(
    () => ticket?.products.findIndex((row) => row.id === pid) ?? -1,
    [ticket, pid],
  );

  const handleStatusUpdate = async (status: string) => {
    if (!product) return;
    setUpdating(true);
    try {
      await rmaApi.updateProductStatus(product.id, status);
      setStatusOpen(false);
      await reload();
    } catch (err) {
      appAlert('Durum güncellenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setUpdating(false);
    }
  };

  const handleProductPhoto = async (uri: string | null) => {
    if (!ticket || !product || !uri) return;
    setUploadingPhoto(true);
    try {
      const attachment = await uploadProductPhoto(ticket.id, product.id, uri);
      const signedUrl = await getAttachmentSignedUrl(attachment.file_path);
      setProductPhotoUrl(product.id, signedUrl);
    } catch (err) {
      appAlert('Görsel yüklenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (error || !ticket || !product || productIndex < 0) {
    return (
      <Screen>
        <AppHeader title="Ürün Detayı" onBack={() => router.back()} />
        <View style={styles.missing}>
          <Text style={styles.missingText}>{error || 'Ürün bulunamadı.'}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader
        title={`Ürün ${productIndex + 1}`}
        subtitle={formatRmaId(ticket)}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <ProductDetailCard
          product={product}
          index={productIndex}
          imageUri={getProductPhotoUrl(product.id)}
          onUpdateStatus={() => setStatusOpen(true)}
          onPhotoChange={handleProductPhoto}
          uploadingPhoto={uploadingPhoto}
        />
      </ScrollView>

      <StatusSheet
        visible={statusOpen}
        currentStatus={product.status}
        loading={updating}
        onClose={() => setStatusOpen(false)}
        onSelect={handleStatusUpdate}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  missingText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
