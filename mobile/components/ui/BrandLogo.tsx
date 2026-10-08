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

  return (
    <Image
      source={!failed && uri ? { uri } : require('../../assets/logo.png')}
      style={style}
      contentFit="contain"
      onError={() => setFailed(true)}
    />
  );
}
