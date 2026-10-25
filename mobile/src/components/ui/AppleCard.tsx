import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../../theme';

export interface AppleCardProps extends PropsWithChildren {
  surface?: 'white' | 'parchment' | 'pearl' | 'dark1';
  bordered?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AppleCard({
  children,
  surface = 'white',
  bordered = true,
  padding = 'lg',
  style,
  testID,
}: AppleCardProps): React.JSX.Element {
  const getBackgroundColor = () => {
    switch (surface) {
      case 'parchment':
        return colors.parchment;
      case 'pearl':
        return colors.pearl;
      case 'dark1':
        return colors.dark1;
      case 'white':
      default:
        return colors.white;
    }
  };

  const getPadding = () => {
    switch (padding) {
      case 'none':
        return 0;
      case 'sm':
        return spacing.sm;
      case 'md':
        return spacing.md;
      case 'lg':
      default:
        return spacing.cardPadding;
    }
  };

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: getBackgroundColor(),
          padding: getPadding(),
          borderWidth: bordered ? 1 : 0,
          borderColor: surface === 'dark1' ? colors.dark2 : colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
});
