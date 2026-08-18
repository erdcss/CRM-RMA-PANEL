import { Alert, ActionSheetIOS, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

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
    quality: 0.85,
    allowsEditing: true,
    aspect: [1, 1],
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

async function pickFromCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Kamera erişim izni gerekli.');
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.85,
    allowsEditing: true,
    aspect: [1, 1],
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

function showPicker(imageUri: string | null | undefined, onSelect: (uri: string | null) => void) {
  const handle = async (source: 'camera' | 'library') => {
    try {
      const uri = source === 'camera' ? await pickFromCamera() : await pickFromLibrary();
      if (uri) onSelect(uri);
    } catch (err) {
      Alert.alert('Fotoğraf seçilemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    }
  };

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Vazgeç', 'Fotoğraf Çek', 'Galeriden Seç', ...(imageUri ? ['Kaldır'] : [])],
        cancelButtonIndex: 0,
        destructiveButtonIndex: imageUri ? 3 : undefined,
      },
      (index) => {
        if (index === 1) void handle('camera');
        if (index === 2) void handle('library');
        if (index === 3 && imageUri) onSelect(null);
      },
    );
    return;
  }

  Alert.alert('Ürün Görseli', 'Kaynak seçin', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Fotoğraf Çek', onPress: () => void handle('camera') },
    { text: 'Galeriden Seç', onPress: () => void handle('library') },
    ...(imageUri ? [{ text: 'Kaldır', style: 'destructive' as const, onPress: () => onSelect(null) }] : []),
  ]);
}

export function ProductImagePicker({ imageUri, onChange, compact }: ProductImagePickerProps) {
  const open = () => showPicker(imageUri, onChange);

  if (compact) {
    return (
      <Pressable style={[styles.compact, imageUri && styles.compactFilled]} onPress={open}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.compactImage} contentFit="cover" />
        ) : (
          <Ionicons name="camera-outline" size={22} color={colors.primary} />
        )}
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.wrap} onPress={open}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} contentFit="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="camera-outline" size={28} color={colors.primary} />
          <Text style={styles.placeholderTitle}>Görsel Ekle / Çek</Text>
          <Text style={styles.placeholderHint}>Kamera veya galeriden seçin</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    minHeight: 120,
  },
  preview: {
    width: '100%',
    height: 160,
  },
  placeholder: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
  },
  placeholderTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  placeholderHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  compact: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compactFilled: {
    borderColor: colors.primary,
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
});
