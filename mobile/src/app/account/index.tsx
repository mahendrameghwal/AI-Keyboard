import { Link, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Screen, ScreenTitle } from '../../components/Screen';
import { Button, Card } from '../../components/ui';
import { useAuth } from '../../features/auth/AuthContext';
import { colors, radii, spacing, typography } from '../../theme';

export default function AccountScreen() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <ScreenTitle testID="account-guest-title">Account</ScreenTitle>
        <Text style={styles.intro}>
          Accounts are optional. Your AI Keyboard is fully functional with just your provider API key.
        </Text>
        <Text style={styles.benefit}>
          Creating an account allows you to sync your writing preferences (tone, style, length)
          across all your phones and tablets.
        </Text>

        <View style={styles.actions}>
          <Button
            testID="account-sign-in"
            variant="primary"
            onPress={() => router.push('/auth/login')}
          >
            Sign In
          </Button>

          <Button
            testID="account-register"
            variant="secondary"
            onPress={() => router.push('/auth/register')}
          >
            Create New Account
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenTitle testID="account-title">Your Account</ScreenTitle>

      <Card surface="pearl" padding="md" style={styles.profileCard}>
        <Text style={styles.cardLabel}>Signed in as</Text>
        <Text testID="user-email" style={styles.userEmail}>
          {user.email}
        </Text>
        <Text style={styles.userId}>User ID: {user.id}</Text>
      </Card>

      <View style={styles.menu}>
        <Link href="/sync" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuContent}>
               <Text style={styles.menuTitle}>Cloud Preference Sync</Text>
              <Text style={styles.menuSub}>Sync tone, style, and length preferences</Text>
            </View>
          </TouchableOpacity>
        </Link>

        <Link href="/account/sessions" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Active Devices & Sessions</Text>
              <Text style={styles.menuSub}>Manage other devices logged into your account</Text>
            </View>
          </TouchableOpacity>
        </Link>

        <Button
          testID="account-logout"
          variant="secondary"
          onPress={async () => {
            await logout();
            router.replace('/account');
          }}
          style={styles.logoutButton}
        >
          Sign Out
        </Button>

        <Link href="/account/delete" style={styles.deleteLink}>
          <Text style={styles.deleteLinkText}>Delete Account (Permanent)</Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    ...typography.lead,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  benefit: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
  },
  profileCard: {
    marginBottom: spacing.regular,
  },
  cardLabel: {
    ...typography.finePrint,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userEmail: {
    ...typography.tagline,
    color: colors.ink,
    marginTop: 4,
  },
  userId: {
    ...typography.finePrint,
    color: colors.textMuted,
    marginTop: 4,
  },
  menu: {
    gap: spacing.sm,
  },
  menuItem: {
    backgroundColor: colors.pearl,
    borderRadius: radii.lg,
    padding: spacing.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuContent: {
    gap: 2,
  },
  menuTitle: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  menuSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  logoutButton: {
    marginTop: spacing.xs,
  },
  deleteLink: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    padding: spacing.xs,
  },
  deleteLinkText: {
    ...typography.caption,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
