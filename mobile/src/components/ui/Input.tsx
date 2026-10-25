import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

export interface InputProps extends TextInputProps {
  style?: StyleProp<TextStyle>;
}

export function Input({
  style,
  onFocus,
  onBlur,
  ...props
}: InputProps): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      {...props}
      onFocus={(e) => {
        setIsFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        onBlur?.(e);
      }}
      placeholderTextColor={colors.textMuted}
      style={[
        styles.input,
        {
          borderColor: isFocused ? colors.primaryFocus : colors.border,
          borderWidth: isFocused ? 1.5 : 1,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    ...typography.body,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.md,
    color: colors.ink,
  },
});

// Backward-compatible alias
export const AppleInput = Input;
export type AppleInputProps = InputProps;
