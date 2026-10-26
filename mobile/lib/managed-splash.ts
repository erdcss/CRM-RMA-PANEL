import type { ImageSourcePropType } from 'react-native';

// Legacy compatibility only. Admin-managed splash is fetched at runtime.
// Never bundle a static backup: removing it in Admin must clear the picture.
export const managedSplash: ImageSourcePropType | null = null;
