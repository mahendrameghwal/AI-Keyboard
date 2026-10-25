import { StyleSheet, Text } from 'react-native';
import { InfoList } from '../components/InfoList';
import { Screen, ScreenTitle } from '../components/Screen';
import { AppleCard } from '../components/ui';
import { DISCLOSURE } from '../features/disclosure/copy';
import { colors, spacing, typography } from '../theme';

export default function Privacy() {
  return (
    <Screen>
      <ScreenTitle testID="privacy-title">{DISCLOSURE.headline}</ScreenTitle>
      <Text style={styles.subtitle}>
        Your privacy and device security come first. Here is how your data is treated.
      </Text>

      <AppleCard surface="pearl" padding="md" style={styles.card}>
        <InfoList items={DISCLOSURE.points} testID="privacy-disclosure" />
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
});
