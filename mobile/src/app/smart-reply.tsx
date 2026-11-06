import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ResultPreview } from '../components/ResultPreview';
import { Screen, ScreenTitle } from '../components/Screen';
import { Button, Card, Input, SegmentedPill } from '../components/ui';
import { useAiTarget } from '../hooks/useAiTarget';
import { describeApiError } from '../services/errors';
import { useAppDeps } from '../services/deps';
import { colors, radii, spacing, typography } from '../theme';
import type { GenerateResponseOutput, Tone } from '@ai-keyboard/shared-contracts/schemas';
import { LIMITS } from '@ai-keyboard/shared-contracts/schemas';

const REPLY_TONES: { id: Tone; label: string }[] = [
  { id: 'polite', label: 'Polite' },
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'friendly', label: 'Friendly' },
];

export default function SmartReplyScreen() {
  const deps = useAppDeps();

  const [receivedMessage, setReceivedMessage] = useState('');
  const [selectedTone, setSelectedTone] = useState<Tone>('polite');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponseOutput | null>(null);

  const { target, preferences } = useAiTarget();

  const onGenerateReply = async () => {
    if (!receivedMessage.trim()) {
      setError('Please paste the message you received.');
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
        action: 'reply',
        text: receivedMessage.trim(),
        settings: {
          tone: selectedTone,
          toneStrength: preferences.toneStrength,
          formality: preferences.formality,
          length: preferences.defaultLength,
          language: preferences.language,
        },
      });
      setResult(response);
    } catch (err) {
      setError(describeApiError(err, 'Failed to generate reply.'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Screen>
      <ScreenTitle testID="smart-reply-title">Smart Replies</ScreenTitle>
      <Text style={styles.subtitle}>
        Paste a message you received to generate context-aware reply options.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Text style={styles.label}>Reply Tone</Text>
          <SegmentedPill
            options={REPLY_TONES}
            selectedId={selectedTone}
            onSelect={setSelectedTone}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Received Message</Text>
          <Card surface="pearl" padding="sm" style={styles.inputCard}>
            <Input
              testID="received-message-input"
              accessibilityLabel="The message you received"
              value={receivedMessage}
              onChangeText={setReceivedMessage}
              placeholder="e.g. Can we reschedule our project sync to Thursday 2 PM?"
              multiline
              numberOfLines={4}
              maxLength={LIMITS.maxTextChars}
              style={styles.textArea}
            />
          </Card>
        </View>

        <Button
          testID="generate-reply-button"
          onPress={onGenerateReply}
          disabled={isGenerating || !target}
          isLoading={isGenerating}
          variant="primary"
        >
          Suggest Reply
        </Button>

        {result ? (
          <ResultPreview
            result={result.result}
            usage={result.usage}
            onRegenerate={onGenerateReply}
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
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
