import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/services/supabase/client';

const storedTokenKey = 'artiz.expoPushToken';
const storedRegistrationKey = 'artiz.pushRegistration';
const pendingTokenKey = 'artiz.pendingExpoPushToken';
type StoredRegistration = { userId: string; token: string };
type RegisterOptions = { userId: string; requestPermission: boolean; adminOnly?: boolean };

let suspended = false;
let operation: Promise<unknown> = Promise.resolve();
let latestToken: string | null = null;

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = operation.then(task);
  operation = result.catch(() => {});
  return result;
}

async function storedRegistration(): Promise<StoredRegistration | null> {
  const value = await AsyncStorage.getItem(storedRegistrationKey);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as StoredRegistration;
    return typeof parsed.userId === 'string' && typeof parsed.token === 'string' ? parsed : null;
  } catch { return null; }
}

export function resumePushRegistration() { suspended = false; }

export function registerPushForCurrentDevice(options: RegisterOptions): Promise<void> {
  return enqueue(async () => {
    if (suspended) return;
    if (!supabase || !Device.isDevice || Platform.OS === 'web') {
      throw new Error('Les notifications nécessitent un téléphone physique.');
    }
    if (Constants.appOwnership === 'expo') {
      throw new Error('Les notifications push nécessitent une version de développement Artiz.');
    }
    // A recovery link or another sign-in path can switch accounts without the profile logout button.
    // Take ownership of a locally remembered token, then remove it before using the new session.
    const remembered = await storedRegistration();
    const legacyToken = remembered ? null : await AsyncStorage.getItem(storedTokenKey);
    const pendingToken = await AsyncStorage.getItem(pendingTokenKey);
    const staleTokens = new Set([remembered?.userId !== options.userId ? remembered?.token : null,
      legacyToken, pendingToken].filter((value): value is string => Boolean(value)));
    if (staleTokens.size) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || user?.id !== options.userId || suspended) return;
      for (const token of staleTokens) {
        const { error: transferError } = await supabase.rpc('register_push_token', {
          token,
          device_platform: Platform.OS === 'ios' ? 'ios' : 'android',
        });
        if (transferError) throw transferError;
        const { error: deleteError } = await supabase.from('push_tokens').delete().eq('expo_push_token', token);
        if (deleteError) throw deleteError;
      }
      await AsyncStorage.multiRemove([...(remembered?.userId !== options.userId ? [storedRegistrationKey] : []),
        storedTokenKey, pendingTokenKey]);
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (typeof projectId !== 'string' || !projectId) {
      throw new Error('Le projet EAS doit être configuré pour les notifications.');
    }
    const Notifications = await import('expo-notifications');
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('artiz-updates', {
        name: 'Activité Artiz',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const allowed = (status: typeof current) => status.granted
      || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    const permission = allowed(current) || !options.requestPermission
      ? current : await Notifications.requestPermissionsAsync();
    if (!allowed(permission)) {
      if (options.requestPermission) throw new Error('Autorisez les notifications dans les réglages du téléphone.');
      return;
    }
    const expoToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    latestToken = expoToken;
    if (suspended) return;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || user?.id !== options.userId || suspended) return;

    const previous = await storedRegistration();
    const previousToken = previous?.token ?? await AsyncStorage.getItem(storedTokenKey);
    // Save the new token before the RPC so a process restart cannot orphan it on the server.
    await AsyncStorage.setItem(pendingTokenKey, expoToken);
    const { error } = options.adminOnly
      ? await supabase.rpc('register_admin_push_token', {
          token: expoToken,
          device_platform: Platform.OS === 'ios' ? 'ios' : 'android',
          previous_token: previous?.userId === options.userId ? previousToken : null,
        })
      : await supabase.rpc('register_push_token', {
          token: expoToken,
          device_platform: Platform.OS === 'ios' ? 'ios' : 'android',
        });
    if (error) throw error;
    if (suspended) return;
    if (!options.adminOnly && previous?.userId === options.userId && previousToken && previousToken !== expoToken) {
      await supabase.from('push_tokens').delete().eq('expo_push_token', previousToken);
    }
    await AsyncStorage.setItem(storedRegistrationKey, JSON.stringify({ userId: options.userId, token: expoToken }));
    await AsyncStorage.multiRemove([storedTokenKey, pendingTokenKey]);
  });
}

export function revokePushForCurrentDevice(): Promise<void> {
  suspended = true;
  return enqueue(async () => {
    const previous = await storedRegistration();
    const legacyToken = await AsyncStorage.getItem(storedTokenKey);
    const pendingToken = await AsyncStorage.getItem(pendingTokenKey);
    for (const token of new Set([latestToken, previous?.token, legacyToken, pendingToken]
      .filter((value): value is string => Boolean(value)))) {
      if (supabase) {
        const { error } = await supabase.from('push_tokens').delete().eq('expo_push_token', token);
        if (error) throw error;
      }
    }
    latestToken = null;
    await AsyncStorage.multiRemove([storedRegistrationKey, storedTokenKey, pendingTokenKey]);
    if (Platform.OS !== 'web' && Constants.appOwnership !== 'expo') {
      try {
        const Notifications = await import('expo-notifications');
        Notifications.clearLastNotificationResponse();
        await Notifications.dismissAllNotificationsAsync();
      } catch { /* A tray cleanup failure must not keep an account signed in. */ }
    }
  });
}
