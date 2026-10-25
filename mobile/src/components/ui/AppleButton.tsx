import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

export interface AppleButtonProps {
  children: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'dark';
  size?: 'regular' | 'compact';
  disabled?: boolean;
  isLoading?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function AppleButton({
  children,
  onPress,
  variant = 'primary',
  size = 'regular',
  disabled = false,
  isLoading = false,
  testID,
  style,
  textStyle,
}: AppleButtonProps): React.JSX.Element {
  const [isPressed, setIsPressed] = useState(false);

  const getContainerStyle = (): ViewStyle => {
    let backgroundColor: string = colors.primary;
    let borderWidth = 0;
    let borderColor: string | undefined = undefined;

    switch (variant) {
      case 'primary':
        backgroundColor = isPressed ? colors.primaryFocus : colors.primary;
        break;
      case 'secondary':
        backgroundColor = colors.pearl;
        borderWidth = 1;
        borderColor = colors.border;
        break;
      case 'ghost':
        backgroundColor = 'transparent';
        break;
      case 'destructive':
        backgroundColor = colors.destructive;
        break;
      case 'dark':
        backgroundColor = colors.white;
        break;
    }

    return {
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      paddingHorizontal: size === 'compact' ? spacing.md : spacing.lg,
      paddingVertical: size === 'compact' ? 8 : 13,
      minHeight: size === 'compact' ? 36 : 48,
      backgroundColor,
      borderWidth,
      borderColor,
      opacity: disabled || isLoading ? 0.5 : 1,
    };
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'primary':
      case 'destructive':
        return colors.white;
      case 'secondary':
      case 'dark':
        return colors.ink;
      case 'ghost':
        return colors.primary;
      default:
        return colors.ink;
    }
  };

  const getTextStyle = (): TextStyle => {
    return {
      ...typography.bodyStrong,
      fontSize: size === 'compact' ? 14 : 16,
      color: getTextColor(),
    };
  };

  return (
    <TouchableOpacity
      testID={testID}
      disabled={disabled || isLoading}
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      activeOpacity={0.8}
      style={[getContainerStyle(), style]}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'dark' ? colors.ink : colors.white}
        />
      ) : (
        <Text style={[getTextStyle(), textStyle]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}
