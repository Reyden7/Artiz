import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && publishableKey
  ? createClient(url, publishableKey, {
      auth: { ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}), autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
  : null;

export const isSupabaseConfigured = Boolean(supabase);
