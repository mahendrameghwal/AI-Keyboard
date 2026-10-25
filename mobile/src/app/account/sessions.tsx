import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Screen, ScreenTitle } from '../../components/Screen';
import { Button, Card } from '../../components/ui';
import { useAppDeps } from '../../services/deps';
import { colors, radii, spacing, typography } from '../../theme';

export default function SessionsScreen() {
  const deps = useAppDeps();
  const queryClient = useQueryClient();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['account-sessions'],
    queryFn: () => deps.api.sessions(),
  });

  const onRevoke = async (id: string) => {
    setRevokingId(id);
    setError(null);
    try {
      await deps.api.revokeSession(id);
      await queryClient.invalidateQueries({ queryKey: ['account-sessions'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Screen>
      <ScreenTitle testID="sessions-title">Active Sessions</ScreenTitle>
      <Text style={styles.subtitle}>
        These are the devices currently logged into your account. You can revoke any session to sign
        that device out.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : isError ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Could not load sessions.</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : data?.sessions.length === 0 ? (
        <Text style={styles.emptyText}>No active sessions found.</Text>
      ) : (
        <FlatList
          data={data?.sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card surface="pearl" padding="sm" style={styles.sessionCard}>
              <View style={styles.sessionInfo}>
                <Text style={styles.deviceName}>
                  {item.device?.name ?? `${item.device?.platform ?? 'Unknown'} Device`}
                </Text>
                <Text style={styles.sessionMeta}>
                  Last active: {new Date(item.lastUsedAt).toLocaleDateString()}
                </Text>
                <Text style={styles.sessionMeta}>
                  Created: {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>

              <Button
                testID={`revoke-session-${item.id}`}
                disabled={revokingId === item.id}
                isLoading={revokingId === item.id}
                onPress={() => onRevoke(item.id)}
                size="compact"
                variant="destructive"
              >
                Sign Out
              </Button>
            </Card>
          )}
        />
      )}
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
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.section,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionInfo: {
    flex: 1,
    marginRight: spacing.sm,
    gap: 2,
  },
  deviceName: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  sessionMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  retryButton: {
    padding: 8,
  },
  retryText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
});
