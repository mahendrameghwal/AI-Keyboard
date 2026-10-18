import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { api, clientWithKey, preferences, providerKeys } from '../services/api';
import { DepsProvider, type AppDeps } from '../services/deps';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const deps = useMemo<AppDeps>(() => ({ api, providerKeys, preferences, clientWithKey }), []);

  return (
    <DepsProvider deps={deps}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }} />
      </QueryClientProvider>
    </DepsProvider>
  );
}
