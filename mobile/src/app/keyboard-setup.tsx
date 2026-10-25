import { Platform, StyleSheet, Text, View } from 'react-native';
import { InfoList } from '../components/InfoList';
import { Screen, ScreenTitle } from '../components/Screen';
import { AppleCard } from '../components/ui';
import { KEYBOARD_SETUP } from '../features/disclosure/copy';
import { colors, spacing, typography } from '../theme';

/**
 * Instructions only. Showing whether the keyboard is actually enabled needs the native
 * module (plan T6.4); until that exists this screen must not imply any status (FR-01).
 */
export default function KeyboardSetup() {
  const steps =
    Platform.OS === 'ios'
      ? [...KEYBOARD_SETUP.android, ...KEYBOARD_SETUP.ios]
      : [...KEYBOARD_SETUP.android];

  return (
    <Screen>
      <ScreenTitle testID="keyboard-setup-title">Enable the keyboard</ScreenTitle>
      <Text style={styles.subtitle}>
        Follow these steps to activate AI Keyboard in your device system settings.
      </Text>

      <AppleCard surface="pearl" padding="md" style={styles.card}>
        <InfoList items={steps} testID="keyboard-setup-steps" />
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            The keyboard input method itself is deployed via Phase 2; this screen lists setup
            instructions for system keyboard settings.
          </Text>
        </View>
      </AppleCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.regular,
  },
  card: {
    marginBottom: spacing.section,
  },
  noteBox: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  noteText: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
