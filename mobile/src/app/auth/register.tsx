import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen, ScreenTitle } from '../../components/Screen';
import { AppleButton, AppleCard, AppleInput } from '../../components/ui';
import { useAuth } from '../../features/auth/AuthContext';
import { colors, radii, spacing, typography } from '../../theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await register(email.trim(), password);
      router.replace('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScreenTitle testID="register-title">Create Account</ScreenTitle>
      <Text style={styles.subtitle}>
        Accounts are optional and used solely for synchronizing your writing preferences.
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
            testID="register-email"
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password (minimum 8 characters)</Text>
          <AppleInput
            testID="register-password"
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm Password</Text>
          <AppleInput
            testID="register-confirm-password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm Password"
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <AppleButton
          testID="register-submit"
          onPress={onSubmit}
          disabled={isSubmitting}
          isLoading={isSubmitting}
          variant="primary"
          style={styles.submitBtn}
        >
          Create Account
        </AppleButton>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/auth/login" style={styles.link}>
            Sign In
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
