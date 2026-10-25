import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { AuthProvider } from '../features/auth/AuthContext';
import { api, authStore, clientWithKey, preferences, providerKeys } from '../services/api';
import { DepsProvider, type AppDeps } from '../services/deps';
import { colors } from '../theme';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const deps = useMemo<AppDeps>(
    () => ({ api, auth: authStore, providerKeys, preferences, clientWithKey }),
    [],
  );

  return (
    <DepsProvider deps={deps}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Stack
            screenOptions={{
              headerBackButtonDisplayMode: 'minimal',
              headerStyle: { backgroundColor: colors.white },
              headerTintColor: colors.primary,
              headerTitleStyle: { fontWeight: '600', color: colors.ink },
              headerShadowVisible: false,
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    </DepsProvider>
  );
}
