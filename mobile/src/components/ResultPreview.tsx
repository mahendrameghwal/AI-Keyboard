import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';
import { AppleButton } from './ui/AppleButton';

interface EmailResult {
  subject: string;
  body: string;
}

interface ResultPreviewProps {
  result?: string;
  email?: EmailResult;
  usage?: { inputTokens?: number; outputTokens?: number };
  onRegenerate?(): void;
  isLoading?: boolean;
}

export function ResultPreview({
  result,
  email,
  usage,
  onRegenerate,
  isLoading,
}: ResultPreviewProps): React.JSX.Element | null {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  if (!result && !email) return null;

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
    setCopiedText(`${label} copied!`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Result</Text>
        {usage ? (
          <Text style={styles.usage}>
            {usage.inputTokens ?? 0} in / {usage.outputTokens ?? 0} out tokens
          </Text>
        ) : null}
      </View>

      {email ? (
        <View style={styles.emailContainer}>
          <View style={styles.emailBlock}>
            <Text style={styles.emailLabel}>Subject</Text>
            <Text testID="email-subject-result" style={styles.emailContent}>
              {email.subject}
            </Text>
            <TouchableOpacity
              onPress={() => handleCopy(email.subject, 'Subject')}
              style={styles.copyPill}
            >
              <Text style={styles.copyPillText}>Copy Subject</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.emailBlock}>
            <Text style={styles.emailLabel}>Body</Text>
            <Text testID="email-body-result" style={styles.emailContent}>
              {email.body}
            </Text>
            <TouchableOpacity
              onPress={() => handleCopy(email.body, 'Body')}
              style={styles.copyPill}
            >
              <Text style={styles.copyPillText}>Copy Body</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.resultBox}>
          <Text testID="text-result" style={styles.resultText}>
            {result}
          </Text>
        </View>
      )}

      {copiedText ? <Text style={styles.copiedAlert}>{copiedText}</Text> : null}

      <View style={styles.actions}>
        {!email && result ? (
          <AppleButton
            testID="copy-result-button"
            onPress={() => handleCopy(result, 'Text')}
            variant="primary"
            style={{ flex: 1 }}
          >
            Copy Text
          </AppleButton>
        ) : null}

        {onRegenerate ? (
          <AppleButton
            testID="regenerate-button"
            onPress={onRegenerate}
            variant="secondary"
            isLoading={isLoading}
            style={{ flex: 1 }}
          >
            Regenerate
          </AppleButton>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.cardPadding,
    marginTop: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.tagline,
    color: colors.ink,
  },
  usage: {
    ...typography.finePrint,
    color: colors.textMuted,
  },
  resultBox: {
    backgroundColor: colors.pearl,
    borderRadius: radii.md,
    padding: spacing.regular,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  resultText: {
    ...typography.body,
    color: colors.ink,
  },
  emailContainer: { gap: spacing.md },
  emailBlock: {
    backgroundColor: colors.pearl,
    borderRadius: radii.md,
    padding: spacing.regular,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: spacing.sm,
  },
  emailLabel: {
    ...typography.finePrint,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  emailContent: {
    ...typography.body,
    color: colors.ink,
  },
  copyPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.parchment,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyPillText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  copiedAlert: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: { flexDirection: 'row', gap: spacing.md },
});
