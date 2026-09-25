import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { registerPushForCurrentDevice, resumePushRegistration } from '@/features/notifications/push';
import { supabase } from '@/services/supabase/client';

export function usePushRegistration(userId: string | undefined) {
  useEffect(() => {
    if (!userId || !supabase || Platform.OS === 'web') return;
    const client = supabase;
    const activeUserId = userId;
    let active = true;
    let removeTokenListener = () => {};
    let lastError = '';
    resumePushRegistration();

    async function sync(requestPermission: boolean) {
      const { data: isAdmin, error } = await client.rpc('is_artiz_admin_self');
      if (error || !active) return;
      try {
        await registerPushForCurrentDevice({
          userId: activeUserId,
          adminOnly: isAdmin === true,
          requestPermission: requestPermission && isAdmin === true,
        });
        lastError = '';
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Échec de l’enregistrement push';
        if (__DEV__ && active && message !== lastError) console.warn('Notifications :', message);
        lastError = message;
      }
    }

    void sync(true);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync(false);
    });
    void import('expo-notifications').then((Notifications) => {
      if (!active) return;
      const listener = Notifications.addPushTokenListener(() => { void sync(false); });
      removeTokenListener = () => listener.remove();
    }).catch(() => {});
    return () => { active = false; foreground.remove(); removeTokenListener(); };
  }, [userId]);
}
