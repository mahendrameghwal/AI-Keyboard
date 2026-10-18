import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { InfoList } from '../components/InfoList';
import { Screen, ScreenTitle } from '../components/Screen';
import { DISCLOSURE } from '../features/disclosure/copy';
import { API_BASE_URL } from '../services/api';

/** Phase 6 replaces this Welcome flow with the full onboarding sequence (SRS §6.1). */
export default function Welcome() {
  return (
    <Screen>
      <ScreenTitle testID="welcome-title">AI Keyboard</ScreenTitle>
      <Text style={styles.lede}>
        Fix, rewrite, shorten, expand, summarize and draft from any text field, using an AI provider
        key you bring yourself.
      </Text>
      <InfoList title={DISCLOSURE.headline} items={DISCLOSURE.points} testID="welcome-disclosure" />
      <Link href="/providers" style={styles.cta}>
        Add your API key
      </Link>
      <Link href="/keyboard-setup" style={styles.cta}>
        Enable the keyboard
      </Link>
      <Link href="/privacy" style={styles.link}>
        How your text and key are handled
      </Link>
      <Text testID="api-target" style={styles.footer}>
        API: {API_BASE_URL}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  cta: { fontSize: 16, fontWeight: '600', color: '#1d4ed8', marginBottom: 12 },
  link: { fontSize: 15, color: '#1d4ed8' },
  footer: { marginTop: 'auto', fontSize: 12, color: '#6b7280' },
});
