import { useState } from 'react';
import {
  ActionSheetIOS,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appAlert } from '@/lib/appAlert';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { persistLocalImage } from '@/lib/attachments';

type ProductImagePickerProps = {
  imageUri?: string | null;
  onChange: (uri: string | null) => void;
  compact?: boolean;
};

async function pickFromLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Galeri erişim izni gerekli.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
    exif: false,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible});

  if (result.canceled || !result.assets[0]) return null;
  return persistLocalImage(result.assets[0].uri);
}

async function pickFromCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Kamera erişim izni gerekli.');
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: false,
    exif: false,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible});

  if (result.canceled || !result.assets[0]) return null;
  return persistLocalImage(result.assets[0].uri);
}

function showPicker(imageUri: string | null | undefined, onSelect: (uri: string | null) => void) {
  const handle = async (source: 'camera' | 'library') => {
    try {
      const uri = source === 'camera' ? await pickFromCamera() : await pickFromLibrary();
      if (uri) onSelect(uri);
    } catch (err) {
      appAlert('Fotoğraf seçilemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    }
  };

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Vazgeç', 'Fotoğraf Çek', 'Galeriden Seç', ...(imageUri ? ['Kaldır'] : [])],
        cancelButtonIndex: 0,
        destructiveButtonIndex: imageUri ? 3 : undefined},
      (index) => {
        if (index === 1) void handle('camera');
        if (index === 2) void handle('library');
        if (index === 3 && imageUri) onSelect(null);
      },
    );
    return;
  }

  appAlert('Ürün Görseli', 'Kaynak seçin', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Fotoğraf Çek', onPress: () => void handle('camera') },
    { text: 'Galeriden Seç', onPress: () => void handle('library') },
    ...(imageUri ? [{ text: 'Kaldır', style: 'destructive' as const, onPress: () => onSelect(null) }] : []),
  ]);
}

export function ProductImagePicker({ imageUri, onChange, compact }: ProductImagePickerProps) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const openPicker = () => showPicker(imageUri, onChange);

  const openViewer = () => {
    if (imageUri) setViewerVisible(true);
    else openPicker();
  };

  const editFromViewer = () => {
    setViewerVisible(false);
    setTimeout(openPicker, 150);
  };

  const removeFromViewer = () => {
    setViewerVisible(false);
    onChange(null);
  };

  const viewer = imageUri ? (
    <Modal
      visible={viewerVisible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => setViewerVisible(false)}
    >
      <View style={styles.viewer}>
        <View style={styles.viewerHeader}>
          <Text style={styles.viewerTitle}>Ürün Görseli</Text>
          <Pressable style={styles.viewerIconButton} onPress={() => setViewerVisible(false)}>
            <Ionicons name="close" size={28} color={colors.surface} />
          </Pressable>
        </View>

        <Pressable style={styles.viewerImageWrap} onPress={() => setViewerVisible(false)}>
          <Image source={{ uri: imageUri }} style={styles.viewerImage} contentFit="contain" />
        </Pressable>

        <View style={styles.viewerActions}>
          <Pressable style={styles.viewerActionButton} onPress={editFromViewer}>
            <Ionicons name="create-outline" size={20} color={colors.surface} />
            <Text style={styles.viewerActionText}>Değiştir</Text>
          </Pressable>
          <Pressable style={styles.viewerActionButton} onPress={removeFromViewer}>
            <Ionicons name="trash-outline" size={20} color={colors.surface} />
            <Text style={styles.viewerActionText}>Kaldır</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  ) : null;

  if (compact) {
    return (
      <>
        <Pressable style={[styles.compact, imageUri && styles.compactFilled]} onPress={openViewer}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={styles.compactImage} contentFit="cover" />
              <View style={styles.expandBadge}>
                <Ionicons name="expand-outline" size={13} color={colors.surface} />
              </View>
            </>
          ) : (
            <Ionicons name="camera-outline" size={22} color={colors.primary} />
          )}
        </Pressable>
        {viewer}
      </>
    );
  }

  return (
    <>
      <View style={styles.wrap}>
        {imageUri ? (
          <>
            <Pressable onPress={openViewer}>
              <Image source={{ uri: imageUri }} style={styles.preview} contentFit="cover" />
              <View style={styles.previewOverlay}>
                <Ionicons name="expand-outline" size={18} color={colors.surface} />
                <Text style={styles.previewOverlayText}>Tam ekran görüntüle</Text>
              </View>
            </Pressable>
            <Pressable style={styles.changeButton} onPress={openPicker}>
              <Ionicons name="camera-outline" size={18} color={colors.primaryDark} />
              <Text style={styles.changeButtonText}>Fotoğrafı Değiştir</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.placeholder} onPress={openPicker}>
            <Ionicons name="camera-outline" size={28} color={colors.primary} />
            <Text style={styles.placeholderTitle}>Görsel Ekle / Çek</Text>
            <Text style={styles.placeholderHint}>Kamera veya galeriden seçin</Text>
          </Pressable>
        )}
      </View>
      {viewer}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    minHeight: 120},
  preview: {
    width: '100%',
    height: 190},
  previewOverlay: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.65)'},
  previewOverlayText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700'},
  changeButton: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.primarySoft},
  changeButtonText: {
    ...typography.bodyMedium,
    color: colors.primaryDark},
  placeholder: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg},
  placeholderTitle: {
    ...typography.bodyMedium,
    color: colors.text},
  placeholderHint: {
    ...typography.caption,
    color: colors.textMuted},
  compact: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'},
  compactFilled: {
    borderColor: colors.primary},
  compactImage: {
    width: '100%',
    height: '100%'},
  expandBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.68)'},
  viewer: {
    flex: 1,
    backgroundColor: '#000000'},
  viewerHeader: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'},
  viewerTitle: {
    ...typography.subtitle,
    color: colors.surface},
  viewerIconButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center'},
  viewerImageWrap: {
    flex: 1},
  viewerImage: {
    width: '100%',
    height: '100%'},
  viewerActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl},
  viewerActionButton: {
    flex: 1,
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm},
  viewerActionText: {
    ...typography.bodyMedium,
    color: colors.surface}});
