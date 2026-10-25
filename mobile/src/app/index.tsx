import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackendHealthBanner } from '../components/BackendHealthBanner';
import { InfoList } from '../components/InfoList';
import { Screen, ScreenTitle } from '../components/Screen';
import { AppleCard } from '../components/ui/AppleCard';
import { useAuth } from '../features/auth/AuthContext';
import { DISCLOSURE } from '../features/disclosure/copy';
import { API_BASE_URL } from '../services/api';
import { colors, radii, spacing, typography } from '../theme';

export default function HomeScreen() {
  const { user } = useAuth();

  return (
    <Screen surface="parchment" style={styles.screen}>
      <BackendHealthBanner />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <ScreenTitle testID="welcome-title">AI Keyboard</ScreenTitle>
          <Text style={styles.tagline}>
            Transform your writing in every app. Intelligent, private, and instant.
          </Text>
          <View style={styles.badgeRow}>
            {user ? (
              <View style={styles.authPill}>
                <Text style={styles.authText}>Signed in as {user.email}</Text>
              </View>
            ) : (
              <View style={styles.authPill}>
                <Text style={styles.authText}>Guest Mode (Local Only)</Text>
              </View>
            )}
          </View>
        </View>

        {/* AI Writing Workbench (White Cards on Parchment) */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>AI Writing Tools</Text>

          <Link href="/assistant" asChild>
            <AppleCard surface="white" style={styles.featureCard}>
              <Text style={styles.cardEyebrow}>Writing Assistant</Text>
              <Text style={styles.cardTitle}>Rewrite, Fix & Expand</Text>
              <Text style={styles.cardDesc}>
                Fix grammar, refine tone from diplomatic to assertive, or summarize text with one tap.
              </Text>
            </AppleCard>
          </Link>

          <Link href="/email" asChild>
            <AppleCard surface="white" style={styles.featureCard}>
              <Text style={styles.cardEyebrow}>Email Generator</Text>
              <Text style={styles.cardTitle}>Full Email Drafting</Text>
              <Text style={styles.cardDesc}>
                Turn short bullet points into structured emails with dedicated subject lines.
              </Text>
            </AppleCard>
          </Link>

          <Link href="/smart-reply" asChild>
            <AppleCard surface="white" style={styles.featureCard}>
              <Text style={styles.cardEyebrow}>Smart Replies</Text>
              <Text style={styles.cardTitle}>Context-Aware Responses</Text>
              <Text style={styles.cardDesc}>
                Paste messages to generate polite, professional, or casual replies instantly.
              </Text>
            </AppleCard>
          </Link>
        </View>

        {/* Dark Surface Section (Apple Dark-1 Contrast Section) */}
        <View style={styles.darkSection}>
          <Text style={styles.darkSectionEyebrow}>Settings & Accounts</Text>
          <Text style={styles.darkSectionTitle}>Personalized & Synced.</Text>

          <View style={styles.darkCardGrid}>
            <Link href="/providers" asChild>
              <AppleCard surface="dark1" bordered={false} style={styles.darkCard}>
                <Text style={styles.darkLinkText}>
                  AI Provider Settings →
                </Text>
                <Text style={styles.darkCardDesc}>
                  Configure your OpenAI, Gemini, or Anthropic API key with zero server storage.
                </Text>
              </AppleCard>
            </Link>

            <Link href="/sync" asChild>
              <AppleCard surface="dark1" bordered={false} style={styles.darkCard}>
                <Text style={styles.darkLinkText}>Writing Preferences & Sync →</Text>
                <Text style={styles.darkCardDesc}>
                  Set default tone and length across all your phones and tablets.
                </Text>
              </AppleCard>
            </Link>

            <Link href="/account" asChild>
              <AppleCard surface="dark1" bordered={false} style={styles.darkCard}>
                <Text style={styles.darkLinkText}>Account & Device Sessions →</Text>
                <Text style={styles.darkCardDesc}>
                  {user ? 'Manage active sessions or sign out.' : 'Optional sign-in for cross-device sync.'}
                </Text>
              </AppleCard>
            </Link>

            <Link href="/keyboard-setup" asChild>
              <AppleCard surface="dark1" bordered={false} style={styles.darkCard}>
                <Text style={styles.darkLinkText}>
                  Keyboard Setup Guide →
                </Text>
                <Text style={styles.darkCardDesc}>
                  Instructions to activate and select AI Keyboard in system settings.
                </Text>
              </AppleCard>
            </Link>
          </View>
        </View>

        {/* Privacy & Disclosure */}
        <View style={styles.disclosureSection}>
          <InfoList
            title={DISCLOSURE.headline}
            items={DISCLOSURE.points}
            testID="welcome-disclosure"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Link href="/privacy" style={styles.footerLink}>
            Privacy Policy & Security
          </Link>
          <Text testID="api-target" style={styles.footerText}>
            API: {API_BASE_URL}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  scroll: { paddingBottom: spacing.sectionMobile },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  tagline: {
    ...typography.body,
    color: colors.textMuted,
  },
  badgeRow: { marginTop: spacing.sm },
  authPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.parchment,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  authText: {
    ...typography.finePrint,
    color: colors.ink,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  sectionHeader: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  featureCard: { gap: spacing.xs },
  cardEyebrow: {
    ...typography.finePrint,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  cardTitle: {
    ...typography.tagline,
    color: colors.ink,
  },
  cardDesc: {
    ...typography.body,
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
  darkSection: {
    backgroundColor: colors.dark1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sectionMobile,
    gap: spacing.md,
  },
  darkSectionEyebrow: {
    ...typography.finePrint,
    color: colors.textMutedDark,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  darkSectionTitle: {
    ...typography.displayMedium,
    color: colors.textOnDark,
    marginBottom: spacing.md,
  },
  darkCardGrid: { gap: spacing.md },
  darkCard: {
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.dark3,
    gap: spacing.xs,
  },
  darkLinkText: {
    ...typography.bodyStrong,
    color: colors.primaryDark,
  },
  darkCardDesc: {
    ...typography.caption,
    color: colors.textMutedDark,
  },
  disclosureSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  footerText: {
    ...typography.finePrint,
    color: colors.textMuted,
  },
});
