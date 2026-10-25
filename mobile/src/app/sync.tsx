import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen, ScreenTitle } from '../components/Screen';
import { AppleButton, AppleCard, SegmentedPill } from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';
import { SyncService } from '../features/sync/syncService';
import { useAppDeps } from '../services/deps';
import { colors, radii, spacing, typography } from '../theme';
import type { PreferencesOutput } from '@ai-keyboard/shared-contracts/schemas';

const STYLES = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'polite', label: 'Polite' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'confident', label: 'Confident' },
] as const;

const STRENGTHS = [
  { id: 'soft', label: 'Soft' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'hard', label: 'Hard' },
] as const;

const FORMALITIES = [
  { id: 'formal', label: 'Formal' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'informal', label: 'Informal' },
] as const;

const LENGTHS = [
  { id: 'very_short', label: 'Very Short' },
  { id: 'short', label: 'Short' },
  { id: 'normal', label: 'Normal' },
  { id: 'detailed', label: 'Detailed' },
  { id: 'elaborate', label: 'Elaborate' },
] as const;

const LANGUAGES = [
  { id: 'en', label: 'English (US)' },
  { id: 'en-IN', label: 'English (India)' },
] as const;

export default function SyncScreen() {
  const deps = useAppDeps();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const syncService = useMemo(() => new SyncService(deps), [deps]);

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const outcome = await syncService.pull();
      if (outcome.message) setStatusMessage(outcome.message);
      return outcome.preferences;
    },
  });

  const onUpdateField = async <K extends keyof PreferencesOutput>(
    field: K,
    value: PreferencesOutput[K],
  ) => {
    if (!prefs) return;
    const updated: PreferencesOutput = {
      ...prefs,
      [field]: value,
    };

    setSaving(true);
    setStatusMessage(null);
    try {
      const outcome = await syncService.push(updated);
      setStatusMessage(outcome.message);
      await queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    } finally {
      setSaving(false);
    }
  };

  const onManualSync = async () => {
    setSaving(true);
    try {
      const outcome = await syncService.pull();
      setStatusMessage(outcome.message);
      await queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !prefs) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenTitle testID="sync-title">Writing Preferences</ScreenTitle>
      <Text style={styles.subtitle}>
        Customize the default personality, tone strength, and length for your AI keyboard.
      </Text>

      {/* Sync Status Inset */}
      <AppleCard surface="pearl" padding="sm" style={styles.syncCard}>
        <View style={styles.syncInfo}>
          <View style={styles.syncStatusRow}>
            <View
              style={[
                styles.syncIndicator,
                { backgroundColor: user ? '#10B981' : colors.textMuted },
              ]}
            />
            <Text style={styles.syncStatus}>
              {user ? `Cloud Sync: Enabled (${user.email})` : 'Cloud Sync: Disabled (Local Only)'}
            </Text>
          </View>
          <Text style={styles.versionTag}>Version: {prefs.version}</Text>
        </View>

        {user ? (
          <AppleButton
            testID="sync-now-button"
            onPress={onManualSync}
            disabled={saving}
            isLoading={saving}
            size="compact"
            variant="secondary"
          >
            Sync Now
          </AppleButton>
        ) : null}
      </AppleCard>

      {statusMessage ? (
        <View style={styles.messageBanner}>
          <Text testID="sync-message" style={styles.messageText}>
            {statusMessage}
          </Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>
        {/* Writing Style */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Style</Text>
          <SegmentedPill
            options={STYLES}
            selectedId={prefs.writingStyle}
            onSelect={(id) => onUpdateField('writingStyle', id)}
          />
        </View>

        {/* Tone Strength */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tone Strength</Text>
          <SegmentedPill
            options={STRENGTHS}
            selectedId={prefs.toneStrength}
            onSelect={(id) => onUpdateField('toneStrength', id)}
          />
        </View>

        {/* Formality */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Formality</Text>
          <SegmentedPill
            options={FORMALITIES}
            selectedId={prefs.formality}
            onSelect={(id) => onUpdateField('formality', id)}
          />
        </View>

        {/* Length */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Length</Text>
          <SegmentedPill
            options={LENGTHS}
            selectedId={prefs.defaultLength}
            onSelect={(id) => onUpdateField('defaultLength', id)}
          />
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language</Text>
          <SegmentedPill
            options={LANGUAGES}
            selectedId={prefs.language}
            onSelect={(id) => onUpdateField('language', id)}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.regular,
  },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.regular,
  },
  syncInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncIndicator: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  syncStatus: {
    ...typography.caption,
    color: colors.ink,
    fontWeight: '600',
  },
  versionTag: {
    ...typography.finePrint,
    color: colors.textMuted,
    marginTop: 2,
    marginLeft: 16,
  },
  messageBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.regular,
  },
  messageText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
  },
  list: {
    gap: spacing.lg,
    paddingBottom: spacing.section,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.finePrint,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
