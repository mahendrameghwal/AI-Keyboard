import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen, ScreenTitle } from '../../components/Screen';
import { AppleButton, AppleCard } from '../../components/ui';
import { useAuth } from '../../features/auth/AuthContext';
import { useAppDeps } from '../../services/deps';
import { colors, radii, spacing, typography } from '../../theme';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const deps = useAppDeps();
  const { logout } = useAuth();

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirmDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deps.api.deleteAccount();
      await logout();
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule account deletion.');
      setIsDeleting(false);
    }
  };

  return (
    <Screen>
      <ScreenTitle testID="delete-account-title">Delete Account</ScreenTitle>

      <AppleCard surface="pearl" padding="md" style={styles.warningCard}>
        <Text style={styles.warningTitle}>Permanent Action</Text>
        <Text style={styles.warningText}>
          Requesting deletion will immediately sign you out of all devices and schedule your account
          for purge after a 30-day grace period.
        </Text>
        <Text style={styles.warningText}>
          Your cloud-synced preferences, devices, and sessions will be permanently erased.
        </Text>
      </AppleCard>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.actionStack}>
        <AppleButton
          testID="confirm-delete-button"
          disabled={isDeleting}
          isLoading={isDeleting}
          onPress={onConfirmDelete}
          variant="destructive"
        >
          Permanently Delete My Account
        </AppleButton>

        <AppleButton
          onPress={() => router.back()}
          variant="ghost"
          disabled={isDeleting}
        >
          Cancel and Keep Account
        </AppleButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  warningCard: {
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  warningTitle: {
    ...typography.bodyStrong,
    color: colors.destructive,
  },
  warningText: {
    ...typography.body,
    color: colors.destructive,
    lineHeight: 22,
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
  actionStack: {
    gap: spacing.xs,
  },
});
