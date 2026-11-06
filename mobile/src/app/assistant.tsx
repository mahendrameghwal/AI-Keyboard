import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ResultPreview } from '../components/ResultPreview';
import { Screen, ScreenTitle } from '../components/Screen';
import { Button, Card, Input, SegmentedPill } from '../components/ui';
import { useAiTarget } from '../hooks/useAiTarget';
import { describeApiError } from '../services/errors';
import { useAppDeps } from '../services/deps';
import { colors, radii, spacing, typography } from '../theme';
import { LIMITS } from '@ai-keyboard/shared-contracts/schemas';
import type { Action, GenerateResponseOutput, Tone } from '@ai-keyboard/shared-contracts/schemas';

const ACTIONS: { id: Action; label: string }[] = [
  { id: 'fix', label: 'Fix Grammar' },
  { id: 'rewrite', label: 'Rewrite' },
  { id: 'shorten', label: 'Shorten' },
  { id: 'expand', label: 'Expand' },
  { id: 'summarize', label: 'Summarize' },
  { id: 'explain', label: 'Explain' },
  { id: 'continue', label: 'Continue' },
];

const TONE_OPTIONS: { id: Tone; label: string }[] = [
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'polite', label: 'Polite' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'confident', label: 'Confident' },
  { id: 'neutral', label: 'Neutral' },
];

export default function WritingAssistantScreen() {
  const deps = useAppDeps();

  const [text, setText] = useState('');
  const [selectedAction, setSelectedAction] = useState<Action>('rewrite');
  const [toneOverride, setToneOverride] = useState<Tone | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponseOutput | null>(null);

  const { target, preferences } = useAiTarget();
  const tone = toneOverride ?? preferences.writingStyle;

  const onGenerate = async () => {
    if (!text.trim()) {
      setError('Please enter some text first.');
      return;
    }

    if (!target) {
      setError('No active provider and model. Add a key and pick a model in Provider Settings.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const response = await deps.api.generate({
        provider: target.provider,
        model: target.model,
        action: selectedAction,
        text: text.trim(),
        settings: {
          tone,
          toneStrength: preferences.toneStrength,
          formality: preferences.formality,
          length: preferences.defaultLength,
          language: preferences.language,
        },
      });
      setResult(response);
    } catch (err) {
      setError(describeApiError(err, 'Generation failed.'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Screen>
      <ScreenTitle testID="assistant-title">AI Writing Assistant</ScreenTitle>
      <Text style={styles.subtitle}>
        Transform, rewrite, or expand your text using your active AI provider.
      </Text>

      {target ? (
        <View style={styles.providerBadge}>
          <View style={styles.providerDot} />
          <Text style={styles.providerText}>
            Active Model: {target.provider} / {target.model}
          </Text>
        </View>
      ) : (
        <Card surface="pearl" style={styles.warningCard}>
          <Text style={styles.warningTitle}>No AI Provider Configured</Text>
          <Text style={styles.warningText}>
            Add your API key and pick a model in Provider Settings to enable writing assistance.
          </Text>
        </Card>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.container}>
        {/* Action Picker */}
        <View style={styles.section}>
          <Text style={styles.label}>Action</Text>
          <SegmentedPill
            options={ACTIONS}
            selectedId={selectedAction}
            onSelect={setSelectedAction}
            scrollable
            testIDPrefix="action"
          />
        </View>

        {/* Tone Picker */}
        <View style={styles.section}>
          <Text style={styles.label}>Tone</Text>
          <SegmentedPill
            options={TONE_OPTIONS}
            selectedId={tone}
            onSelect={setToneOverride}
            scrollable
          />
        </View>

        {/* Input Text */}
        <View style={styles.section}>
          <Text style={styles.label}>Your Text</Text>
          <Card surface="pearl" padding="sm" style={styles.inputCard}>
            <Input
              testID="assistant-input-text"
              accessibilityLabel="Text to rewrite"
              value={text}
              onChangeText={setText}
              placeholder="Type or paste your text here…"
              multiline
              numberOfLines={4}
              maxLength={LIMITS.maxTextChars}
              style={styles.textArea}
            />
          </Card>
        </View>

        <Button
          testID="assistant-generate-button"
          onPress={onGenerate}
          disabled={isGenerating || !target}
          isLoading={isGenerating}
          variant="primary"
        >
          Generate with AI
        </Button>

        {result ? (
          <ResultPreview
            result={result.result}
            email={result.email}
            usage={result.usage}
            onRegenerate={onGenerate}
            isLoading={isGenerating}
          />
        ) : null}
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
  providerBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pearl,
    paddingHorizontal: spacing.regular,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.regular,
    gap: 8,
  },
  providerDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  providerText: {
    ...typography.caption,
    color: colors.ink,
    fontWeight: '500',
  },
  warningCard: {
    marginBottom: spacing.regular,
  },
  warningTitle: {
    ...typography.bodyStrong,
    color: colors.ink,
    marginBottom: 4,
  },
  warningText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: spacing.regular,
    borderRadius: radii.md,
    marginBottom: spacing.regular,
  },
  errorText: {
    ...typography.caption,
    color: colors.destructive,
  },
  container: {
    gap: spacing.regular,
    paddingBottom: spacing.section,
  },
  section: {
    gap: spacing.xs,
  },
  label: {
    ...typography.finePrint,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputCard: {
    backgroundColor: colors.white,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
});
