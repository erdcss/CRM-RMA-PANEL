import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { rssiLabel, type NiimbotPrinter } from '@/lib/niimbot/types';

type PrinterPickerModalProps = {
  visible: boolean;
  scanning: boolean;
  printers: NiimbotPrinter[];
  error?: string | null;
  onClose: () => void;
  onScan: () => void;
  onConnect: (printer: NiimbotPrinter) => void;
};

export function PrinterPickerModal({
  visible,
  scanning,
  printers,
  error,
  onClose,
  onScan,
  onConnect,
}: PrinterPickerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Yakındaki Yazıcılar</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <Pressable style={[styles.scanBtn, scanning && styles.disabled]} onPress={onScan} disabled={scanning}>
          <Ionicons name="bluetooth-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.scanText}>{scanning ? 'Aranıyor…' : 'Yeniden Ara'}</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <ScrollView contentContainerStyle={styles.list}>
          {printers.length === 0 && !scanning ? (
            <Text style={styles.empty}>Yazıcı bulunamadı. NIIMBOT D110-M açık ve yakında olmalı.</Text>
          ) : null}

          {printers.map((printer) => (
            <View key={printer.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.name}>{printer.name}</Text>
                <Text style={styles.meta}>
                  Sinyal: {rssiLabel(printer.rssi)}
                  {printer.model ? ` · ${printer.model}` : ''}
                </Text>
              </View>
              <Pressable style={styles.connectBtn} onPress={() => onConnect(printer)}>
                <Text style={styles.connectText}>Bağlan</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { ...typography.subtitle, color: colors.text },
  scanBtn: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  scanText: { ...typography.bodyMedium, color: colors.primaryDark, fontWeight: '700' },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  list: { gap: spacing.sm, paddingBottom: spacing.xxxl },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowMain: { flex: 1, gap: spacing.xs },
  name: { ...typography.bodyMedium, color: colors.text, fontWeight: '700' },
  meta: { ...typography.caption, color: colors.textMuted },
  connectBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  connectText: { ...typography.caption, color: colors.surface, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
