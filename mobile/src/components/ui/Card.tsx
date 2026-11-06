import type { PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from '../../theme';

export interface CardProps extends PropsWithChildren<Omit<PressableProps, 'style'>> {
  surface?: 'white' | 'parchment' | 'pearl' | 'dark1';
  bordered?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

/**
 * Root is a Pressable because `<Link asChild>` injects `onPress` here — a plain View
 * would silently swallow it and the card would look tappable but go nowhere.
 */
export function Card({
  children,
  surface = 'white',
  bordered = true,
  padding = 'lg',
  style,
  ...rest
}: CardProps): React.JSX.Element {
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
    <Pressable
      {...rest}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: getBackgroundColor(),
          padding: getPadding(),
          borderWidth: bordered ? 1 : 0,
          borderColor: surface === 'dark1' ? colors.dark2 : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
});

// Backward-compatible alias
export const AppleCard = Card;
export type AppleCardProps = CardProps;
