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
import { Button, Card, Input } from '../components/ui';
import { useAppDeps } from '../services/deps';
import { colors, radii, spacing, typography } from '../theme';
import type { GenerateResponseOutput, Provider } from '@ai-keyboard/shared-contracts/schemas';

export default function EmailGeneratorScreen() {
  const deps = useAppDeps();

  const [notes, setNotes] = useState('');
  const [recipientContext, setRecipientContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponseOutput | null>(null);

  const { data: defaultTarget } = useQuery({
    queryKey: ['default-provider-target'],
    queryFn: () => deps.providerKeys.getDefault(),
  });

  const onGenerateEmail = async () => {
    if (!notes.trim()) {
      setError('Please provide notes or points for the email.');
      return;
    }

    if (!defaultTarget) {
      setError('No AI Provider active. Set one up in Provider Settings.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const combinedText = recipientContext.trim()
        ? `To: ${recipientContext.trim()}\nNotes: ${notes.trim()}`
        : notes.trim();

      const response = await deps.api.generate({
        provider: defaultTarget.provider as Provider,
        model: defaultTarget.model ?? 'gpt-4o-mini',
        action: 'email',
        text: combinedText,
        settings: {
          tone: 'professional',
          toneStrength: 'balanced',
          formality: 'formal',
        },
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate email.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Screen>
      <ScreenTitle testID="email-title">AI Email Generator</ScreenTitle>
      <Text style={styles.subtitle}>
        Generate professional email subjects and bodies from quick notes or bullet points.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Text style={styles.label}>Recipient / Context (Optional)</Text>
          <Input
            testID="email-recipient"
            value={recipientContext}
            onChangeText={setRecipientContext}
            placeholder="e.g. Hiring Manager, Client, Project Lead"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Email Points & Intent</Text>
          <Card surface="pearl" padding="sm" style={styles.inputCard}>
            <Input
              testID="email-notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Send updated design mockups, request review by Friday 5 PM, answer questions about font choices"
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />
          </Card>
        </View>

        <Button
          testID="generate-email-button"
          onPress={onGenerateEmail}
          disabled={isGenerating || !defaultTarget}
          isLoading={isGenerating}
          variant="primary"
        >
          Draft Email
        </Button>

        {result ? (
          <ResultPreview
            email={result.email}
            result={result.result}
            usage={result.usage}
            onRegenerate={onGenerateEmail}
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
