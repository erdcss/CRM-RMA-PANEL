import { forwardRef, type ComponentProps, type ComponentRef } from 'react';
import { Animated, Text as NativeText, TextInput as NativeTextInput, type TextStyle } from 'react-native';

/** The only authorized family and weight for all Çalışkan B2B UI text. */
export const APP_FONT_FAMILY = 'PoppinsRegular';
export const LOCKED_TYPOGRAPHY: Readonly<TextStyle> = Object.freeze({
  fontFamily: APP_FONT_FAMILY,
  fontWeight: '400',
  fontStyle: 'normal',
  letterSpacing: 0,
});

export const Text = forwardRef<ComponentRef<typeof NativeText>, ComponentProps<typeof NativeText>>(
  function AppText({style,...props},ref) {
    return <NativeText {...props} ref={ref} style={[style,LOCKED_TYPOGRAPHY]} />;
  },
);
export const TextInput = forwardRef<ComponentRef<typeof NativeTextInput>, ComponentProps<typeof NativeTextInput>>(
  function AppTextInput({style,...props},ref) {
    return <NativeTextInput {...props} ref={ref} style={[style,LOCKED_TYPOGRAPHY]} />;
  },
);
export const AnimatedText = Animated.createAnimatedComponent(Text);
