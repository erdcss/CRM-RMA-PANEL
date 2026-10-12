import { useEffect, useState } from 'react';
import type { StyleProp, ImageStyle } from 'react-native';
import { Image } from 'expo-image';

export function BrandLogo({
  uri,
  style,
}: {
  uri?: string | null;
  style: StyleProp<ImageStyle>;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  // No bundled legacy logo: only show the image configured in the admin panel.
  if (!uri || failed) return null;

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="contain"
      cachePolicy="memory-disk"
      onError={() => setFailed(true)}
    />
  );
}
