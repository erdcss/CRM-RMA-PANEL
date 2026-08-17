import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/constants/theme';

export type AttachmentItem = {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'video' | 'document';
  sizeLabel?: string;
  dateLabel?: string;
  available?: boolean;
};

const iconMap = {
  image: 'image-outline',
  pdf: 'document-text-outline',
  video: 'videocam-outline',
  document: 'folder-outline',
} as const;

type AttachmentCardProps = {
  item: AttachmentItem;
  onPress?: () => void;
};

export function AttachmentCard({ item, onPress }: AttachmentCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name={iconMap[item.type]} size={20} color={colors.primary} />
        </View>
        <View style={styles.meta}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.sub}>
            {[item.dateLabel, item.sizeLabel].filter(Boolean).join(' · ') || 'Henüz yüklenmedi'}
          </Text>
        </View>
        {item.available ? (
          <Pressable onPress={onPress}>
            <Ionicons name="eye-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Text style={styles.soon}>Yakında</Text>
        )}
      </View>
    </Card>
  );
}

export function AttachmentsSection() {
  const placeholders: AttachmentItem[] = [
    { id: '1', name: 'Ürün fotoğrafları', type: 'image', available: false },
    { id: '2', name: 'Servis formu', type: 'document', available: false },
    { id: '3', name: 'Fatura / PDF', type: 'pdf', available: false },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Evraklar ve Dosyalar</Text>
      <Text style={styles.subtitle}>
        Supabase Storage (`rma-attachments`, `rma-pdfs`) entegrasyonu için hazır altyapı.
      </Text>
      <View style={styles.list}>
        {placeholders.map((item) => (
          <AttachmentCard key={item.id} item={item} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  soon: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
});
