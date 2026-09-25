import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/services/supabase/client';

const storedTokenKey = 'artiz.expoPushToken';

export async function registerPushForCurrentDevice() {
  if (!supabase || !Device.isDevice || Platform.OS === 'web') {
    throw new Error('Les notifications nécessitent un téléphone physique.');
  }
  if (Constants.appOwnership === 'expo') {
    throw new Error('Les notifications push nécessitent une version de développement Artiz.');
  }
  const Notifications = await import('expo-notifications');
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof projectId !== 'string' || !projectId) {
    throw new Error('Le projet EAS doit être configuré pour les notifications.');
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('artiz-updates', {
      name: 'Activité Artiz',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Autorisez les notifications dans les réglages du téléphone.');
  const expoToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.rpc('register_push_token', {
    token: expoToken,
    device_platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  if (error) throw error;
  await AsyncStorage.setItem(storedTokenKey, expoToken);
}

export async function revokePushForCurrentDevice() {
  const token = await AsyncStorage.getItem(storedTokenKey);
  if (token && supabase) {
    const { error } = await supabase.from('push_tokens').delete().eq('expo_push_token', token);
    if (error) throw error;
  }
  await AsyncStorage.removeItem(storedTokenKey);
}
