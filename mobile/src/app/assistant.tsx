import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ResultPreview } from '../components/ResultPreview';
import { Screen, ScreenTitle } from '../components/Screen';
import { Button, Card, Input, SegmentedPill } from '../components/ui';
import { useAppDeps } from '../services/deps';
import { colors, radii, spacing, typography } from '../theme';
import type { Action, GenerateResponseOutput, Provider, Tone } from '@ai-keyboard/shared-contracts/schemas';

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
  const [selectedTone, setSelectedTone] = useState<Tone>('professional');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponseOutput | null>(null);

  // Load configured default provider & model
  const { data: defaultTarget } = useQuery({
    queryKey: ['default-provider-target'],
    queryFn: () => deps.providerKeys.getDefault(),
  });

  const onGenerate = async () => {
    if (!text.trim()) {
      setError('Please enter some text first.');
      return;
    }

    if (!defaultTarget) {
      setError('No AI provider configured. Go to Provider Settings to add your API key.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const response = await deps.api.generate({
        provider: defaultTarget.provider as Provider,
        model: defaultTarget.model ?? 'gpt-4o-mini',
        action: selectedAction,
        text: text.trim(),
        settings: {
          tone: selectedTone,
          toneStrength: 'balanced',
          formality: 'neutral',
          length: 'normal',
        },
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
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

      {defaultTarget ? (
        <View style={styles.providerBadge}>
          <View style={styles.providerDot} />
          <Text style={styles.providerText}>
            Active Model: {defaultTarget.provider} / {defaultTarget.model}
          </Text>
        </View>
      ) : (
        <Card surface="pearl" style={styles.warningCard}>
          <Text style={styles.warningTitle}>No AI Provider Configured</Text>
          <Text style={styles.warningText}>
            Add your API key in Provider Settings to enable writing assistance.
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
            selectedId={selectedTone}
            onSelect={setSelectedTone}
            scrollable
          />
        </View>

        {/* Input Text */}
        <View style={styles.section}>
          <Text style={styles.label}>Your Text</Text>
          <Card surface="pearl" padding="sm" style={styles.inputCard}>
            <Input
              testID="assistant-input-text"
              value={text}
              onChangeText={setText}
              placeholder="Type or paste your text here…"
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />
          </Card>
        </View>

        <Button
          testID="assistant-generate-button"
          onPress={onGenerate}
          disabled={isGenerating || !defaultTarget}
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
