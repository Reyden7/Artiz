import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { useMessageRealtime } from '@/features/messaging/use-message-realtime';
import { usePushEvents } from '@/features/notifications/use-push-events';
import { colors } from '@/constants/artiz';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

function AppNavigator() {
  const { session, loading } = useAuth();
  useMessageRealtime(session?.user.id);
  usePushEvents(session?.user.id);
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}><ActivityIndicator color={colors.blue} /></View>;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="index" options={{ animation: 'none' }} />
    <Stack.Screen name="auth/callback" options={{ animation: 'none' }} />
    <Stack.Protected guard={!session}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack.Protected>
    <Stack.Protected guard={!!session}>
      <Stack.Screen name="(main)" options={{ animation: 'none' }} />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="quote" />
      <Stack.Screen name="professional/[id]" />
      <Stack.Screen name="conversation/[id]" />
      <Stack.Screen name="admin/professionals" />
      <Stack.Screen name="requests" />
    </Stack.Protected>
  </Stack>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
