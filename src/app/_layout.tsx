import { Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { useMessageRealtime } from '@/features/messaging/use-message-realtime';
import { usePushEvents } from '@/features/notifications/use-push-events';
import { usePushRegistration } from '@/features/notifications/use-push-registration';
import { colors } from '@/constants/artiz';
import { Text } from '@/components/typography';
import { installGlobalErrorCapture } from '@/services/global-error-capture';
import { logger } from '@/services/logger';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

export const unstable_settings = { screenErrorBoundary: LoggedErrorBoundary };

function LoggedErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    logger.error('react.render_failed', { error, context: { operation: 'render' } });
  }, [error]);
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background }}>
    <Text style={{ color: colors.navy, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>Une erreur est survenue.</Text>
    <Pressable accessibilityRole="button" onPress={() => { void retry(); }} style={{ padding: 16 }}>
      <Text style={{ color: colors.blue, fontWeight: '700' }}>Réessayer</Text>
    </Pressable>
  </View>;
}

export function ErrorBoundary(props: ErrorBoundaryProps) { return <LoggedErrorBoundary {...props} />; }

function AppNavigator() {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  useEffect(() => { logger.setUserId(session?.user.id ?? null); }, [session?.user.id]);
  useEffect(() => { logger.setRoute(pathname); }, [pathname]);
  useEffect(() => installGlobalErrorCapture(), []);
  useMessageRealtime(session?.user.id);
  usePushEvents(session?.user.id);
  usePushRegistration(session?.user.id);
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}><ActivityIndicator color={colors.blue} /></View>;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="index" options={{ animation: 'none' }} />
    <Stack.Screen name="auth/callback" options={{ animation: 'none' }} />
    <Stack.Screen name="auth/reset-password" options={{ animation: 'none' }} />
    <Stack.Screen name="forgot-password" />
    <Stack.Protected guard={!session}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack.Protected>
    <Stack.Protected guard={!!session}>
      <Stack.Screen name="(main)" options={{ animation: 'none' }} />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="quote" />
      <Stack.Screen name="professional/[id]" />
      <Stack.Screen name="professional/[id]/reviews" />
      <Stack.Screen name="profile/edit" />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="post/report" />
      <Stack.Screen name="conversation/[id]" />
      <Stack.Screen name="admin/professionals" />
      <Stack.Screen name="admin/support/index" />
      <Stack.Screen name="admin/support/[id]" />
      <Stack.Screen name="admin/logs" />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="settings/support/index" />
      <Stack.Screen name="settings/support/new" />
      <Stack.Screen name="settings/support/requests" />
      <Stack.Screen name="settings/support/[id]" />
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
