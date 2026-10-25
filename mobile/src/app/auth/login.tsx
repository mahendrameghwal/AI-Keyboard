import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen, ScreenTitle } from '../../components/Screen';
import { AppleButton, AppleCard, AppleInput } from '../../components/ui';
import { useAuth } from '../../features/auth/AuthContext';
import { colors, radii, spacing, typography } from '../../theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScreenTitle testID="login-title">Sign In</ScreenTitle>
      <Text style={styles.subtitle}>
        Sign in to sync your writing preferences and tone settings across devices.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <AppleCard surface="white" padding="md" style={styles.formCard}>
        <View style={styles.field}>
          <Text style={styles.label}>Email Address</Text>
          <AppleInput
            testID="login-email"
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <AppleInput
            testID="login-password"
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <AppleButton
          testID="login-submit"
          onPress={onSubmit}
          disabled={isSubmitting}
          isLoading={isSubmitting}
          variant="primary"
          style={styles.submitBtn}
        >
          Sign In
        </AppleButton>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/auth/register" style={styles.link}>
            Create one
          </Link>
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
  formCard: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.finePrint,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  footerText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  link: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});
