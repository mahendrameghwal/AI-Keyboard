import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import { colors, spacing, typography } from '../theme';

export interface ScreenProps extends ViewProps {
  surface?: 'white' | 'parchment' | 'dark1';
}

export function Screen({ children, surface = 'white', style, ...rest }: ScreenProps) {
  const getBg = () => {
    switch (surface) {
      case 'parchment':
        return colors.parchment;
      case 'dark1':
        return colors.dark1;
      case 'white':
      default:
        return colors.white;
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: getBg() }, style]} {...rest}>
      {children}
    </View>
  );
}

export function ScreenTitle({
  testID,
  children,
  onDark = false,
}: {
  testID?: string;
  children: string;
  onDark?: boolean;
}) {
  return (
    <Text
      style={[
        styles.title,
        { color: onDark ? colors.textOnDark : colors.ink },
      ]}
      testID={testID}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.displayMedium,
    marginBottom: spacing.sm,
  },
});
