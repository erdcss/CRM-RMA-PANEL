import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { PrinterPickerModal } from '@/components/niimbot/PrinterPickerModal';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { NiimbotPrinterService } from '@/lib/niimbot/NiimbotPrinterService';
import { NiimbotPrinterError, type NiimbotPrinter } from '@/lib/niimbot/types';

export function NiimbotPrinterSection() {
  const [savedPrinter, setSavedPrinter] = useState<NiimbotPrinter | null>(null);
  const [connected, setConnected] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [printers, setPrinters] = useState<NiimbotPrinter[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const saved = await NiimbotPrinterService.getSavedPrinter();
    setSavedPrinter(saved);
    const status = await NiimbotPrinterService.getConnectionStatus();
    setConnected(Boolean(status.connected));
    if (status.printer) setSavedPrinter(status.printer);
  }, []);

  useEffect(() => {
    refreshStatus().catch(() => undefined);
  }, [refreshStatus]);

  const handleScan = async () => {
    setScanning(true);
    setScanError(null);
    setPrinters([]);
    try {
      const found = await NiimbotPrinterService.scanPrinters();
      setPrinters(found);
      if (found.length === 0) {
        setScanError('Yakında NIIMBOT yazıcı bulunamadı.');
      }
    } catch (err) {
      const message =
        err instanceof NiimbotPrinterError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Tarama başarısız';
      setScanError(message);
    } finally {
      setScanning(false);
    }
  };

  const openPicker = async () => {
    setPickerOpen(true);
    await handleScan();
  };

  const handleConnectSaved = async () => {
    if (!savedPrinter) {
      await openPicker();
      return;
    }
    try {
      await NiimbotPrinterService.connectPrinter(savedPrinter);
      await refreshStatus();
      Alert.alert('Bağlandı', `${savedPrinter.name} yazıcısına bağlanıldı.`);
    } catch (err) {
      Alert.alert(
        'Bağlantı başarısız',
        err instanceof NiimbotPrinterError ? err.message : 'Yazıcı bağlantısı kurulamadı.',
      );
    }
  };

  const handleConnectFromList = async (printer: NiimbotPrinter) => {
    try {
      await NiimbotPrinterService.connectPrinter(printer);
      setPickerOpen(false);
      await refreshStatus();
      Alert.alert('Bağlandı', `${printer.name} yazıcısına bağlanıldı.`);
    } catch (err) {
      Alert.alert(
        'Bağlantı başarısız',
        err instanceof NiimbotPrinterError ? err.message : 'Yazıcı bağlantısı kurulamadı.',
      );
    }
  };

  const handleDisconnect = async () => {
    try {
      await NiimbotPrinterService.disconnectPrinter();
      await refreshStatus();
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Bağlantı kesilemedi');
    }
  };

  const statusText = connected
    ? `${savedPrinter?.name ?? 'NIIMBOT D110-M'} Bağlı`
    : savedPrinter
      ? `${savedPrinter.name} · Bağlı değil`
      : 'Bağlı değil';

  return (
    <>
      <Card style={styles.card}>
        <Text style={styles.title}>NIIMBOT Yazıcı</Text>
        <Text style={styles.status}>{statusText}</Text>

        <View style={styles.actions}>
          <ActionButton icon="search-outline" label="Yazıcı Ara" onPress={openPicker} />
          <ActionButton icon="link-outline" label="Bağlan" onPress={handleConnectSaved} />
          <ActionButton icon="close-circle-outline" label="Bağlantıyı Kes" onPress={handleDisconnect} disabled={!connected} />
        </View>
      </Card>

      <PrinterPickerModal
        visible={pickerOpen}
        scanning={scanning}
        printers={printers}
        error={scanError}
        onClose={() => setPickerOpen(false)}
        onScan={handleScan}
        onConnect={handleConnectFromList}
      />
    </>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable style={[styles.actionBtn, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={16} color={colors.primaryDark} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { ...typography.subtitle, color: colors.text },
  status: { ...typography.body, color: colors.textSecondary },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actionText: { ...typography.bodyMedium, color: colors.primaryDark, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
