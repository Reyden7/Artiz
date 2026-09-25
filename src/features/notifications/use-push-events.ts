import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase/client';

function openNotification(url: unknown) {
  if (url === '/admin/professionals') router.push('/admin/professionals');
  else if (url === '/requests') router.push('/requests');
  else if (typeof url === 'string' && /^\/conversation\/[0-9a-f-]{36}$/i.test(url)) {
    router.push(url as `/conversation/${string}`);
  }
}

export function usePushEvents(userId: string | undefined) {
  const queryClient = useQueryClient();
  const lastOpened = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || !supabase) return;
    let active = true;
    let removePushListeners = () => {};
    if (Constants.appOwnership !== 'expo') {
      void import('expo-notifications').then((Notifications) => {
        if (!active) return;
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: false, shouldShowList: false,
            shouldPlaySound: false, shouldSetBadge: false,
          }),
        });
        const received = Notifications.addNotificationReceivedListener(() => {
          void queryClient.invalidateQueries({ queryKey: ['my-notifications', userId] });
        });
        const opened = Notifications.addNotificationResponseReceivedListener((response) => {
          const id = response.notification.request.identifier;
          if (lastOpened.current === id) return;
          lastOpened.current = id;
          openNotification(response.notification.request.content.data?.url);
          void queryClient.invalidateQueries({ queryKey: ['my-notifications', userId] });
        });
        removePushListeners = () => { received.remove(); opened.remove(); };
        void Notifications.getLastNotificationResponseAsync().then((response) => {
          if (!active || !response || lastOpened.current === response.notification.request.identifier) return;
          lastOpened.current = response.notification.request.identifier;
          openNotification(response.notification.request.content.data?.url);
        });
      });
    }
    const channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        () => { void queryClient.invalidateQueries({ queryKey: ['my-notifications', userId] }); })
      .subscribe();
    return () => { active = false; removePushListeners(); void supabase?.removeChannel(channel); };
  }, [userId, queryClient]);
}
