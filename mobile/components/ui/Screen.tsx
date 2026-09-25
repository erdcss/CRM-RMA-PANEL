import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

type ScreenProps = {
  children: ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
};

export function Screen({ children, style, edges = ['top'] }: ScreenProps) {
  const safeEdges = Array.from(new Set(['top', ...edges])) as ('top' | 'bottom' | 'left' | 'right')[];

  return (
    <SafeAreaView style={[styles.screen, style]} edges={safeEdges}>
      {children}
    </SafeAreaView>
  );
}

export function ScreenContent({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.content, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
});
