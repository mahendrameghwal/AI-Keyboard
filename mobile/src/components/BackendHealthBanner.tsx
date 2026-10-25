import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../services/api';
import { useAppDeps } from '../services/deps';

export function BackendHealthBanner(): React.JSX.Element | null {
  const deps = useAppDeps();

  const { isError, isLoading, refetch } = useQuery({
    queryKey: ['backend-health-check'],
    queryFn: () => deps.api.health(),
    retry: 1,
    refetchInterval: 30_000,
  });

  if (isLoading || !isError) {
    return null;
  }

  return (
    <View testID="backend-health-banner" style={styles.banner}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Backend API Offline</Text>
        <Text style={styles.message}>
          Cannot reach {API_BASE_URL}. Ensure your API server is running (`npm run api:dev`).
        </Text>
      </View>
      <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: { flex: 1, marginRight: 8 },
  title: { fontSize: 13, fontWeight: '700', color: '#92400e' },
  message: { fontSize: 12, color: '#b45309', marginTop: 2 },
  retryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fef3c7',
  },
  retryText: { fontSize: 12, fontWeight: '700', color: '#92400e' },
});
