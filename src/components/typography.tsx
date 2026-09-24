import { forwardRef } from 'react';
import { StyleSheet, Text as NativeText, TextProps } from 'react-native';

const fontByWeight = {
  normal: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const Text = forwardRef<NativeText, TextProps>(function Text({ style, ...props }, ref) {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const family = weight === 'bold' || Number(weight) >= 700
    ? fontByWeight.bold
    : Number(weight) >= 600
      ? fontByWeight.semibold
      : weight === '500' || Number(weight) >= 500
        ? fontByWeight.medium
        : fontByWeight.normal;

  return <NativeText ref={ref} {...props} style={[style, { fontFamily: family, fontWeight: 'normal' }]} />;
});
