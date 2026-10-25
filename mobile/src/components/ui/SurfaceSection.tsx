import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '../../theme';

export interface SurfaceSectionProps extends PropsWithChildren {
  surface?: 'white' | 'parchment' | 'dark1' | 'dark2';
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SurfaceSection({
  children,
  surface = 'white',
  style,
  contentStyle,
  testID,
}: SurfaceSectionProps): React.JSX.Element {
  const getBackgroundColor = () => {
    switch (surface) {
      case 'parchment':
        return colors.parchment;
      case 'dark1':
        return colors.dark1;
      case 'dark2':
        return colors.dark2;
      case 'white':
      default:
        return colors.white;
    }
  };

  return (
    <View
      testID={testID}
      style={[
        styles.section,
        {
          backgroundColor: getBackgroundColor(),
        },
        style,
      ]}
    >
      <View style={[styles.inner, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    paddingVertical: spacing.xl,
  },
  inner: {
    paddingHorizontal: spacing.lg,
    gap: spacing.regular,
  },
});
