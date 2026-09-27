import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase/client';

function openNotification(url: unknown) {
  if (url === '/admin/professionals') router.push('/admin/professionals');
  else if (url === '/admin/support') router.push('/admin/support' as import('expo-router').Href);
  else if (url === '/requests') router.push('/requests');
  else if (typeof url === 'string' && /^\/admin\/support\/[0-9a-f-]{36}$/i.test(url)) {
    router.push({ pathname: '/admin/support/[id]', params: { id: url.split('/').pop()! } });
  }
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
    const refreshMessage = (url: unknown) => {
      if (typeof url !== 'string' || !/^\/conversation\/[0-9a-f-]{36}$/i.test(url)) return;
      const conversationId = url.split('/').pop()!;
      void queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['unread-message-counts', userId] });
      void queryClient.invalidateQueries({ queryKey: ['my-conversations', userId] });
    };
    if (Constants.appOwnership !== 'expo') {
      void import('expo-notifications').then((Notifications) => {
        if (!active) return;
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });
        const received = Notifications.addNotificationReceivedListener((notification) => {
          void queryClient.invalidateQueries({ queryKey: ['my-notifications', userId] });
          refreshMessage(notification.request.content.data?.url);
        });
        const opened = Notifications.addNotificationResponseReceivedListener((response) => {
          const id = response.notification.request.identifier;
          if (lastOpened.current === id) return;
          lastOpened.current = id;
          openNotification(response.notification.request.content.data?.url);
          refreshMessage(response.notification.request.content.data?.url);
          Notifications.clearLastNotificationResponse();
          void queryClient.invalidateQueries({ queryKey: ['my-notifications', userId] });
        });
        removePushListeners = () => { received.remove(); opened.remove(); };
        const response = Notifications.getLastNotificationResponse();
        if (active && response && lastOpened.current !== response.notification.request.identifier) {
          lastOpened.current = response.notification.request.identifier;
          openNotification(response.notification.request.content.data?.url);
          refreshMessage(response.notification.request.content.data?.url);
          Notifications.clearLastNotificationResponse();
        }
      });
    }
    const channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        (event) => {
          void queryClient.invalidateQueries({ queryKey: ['my-notifications', userId] });
          if (event.new.kind === 'new_message') {
            const payload = event.new.payload;
            if (payload && typeof payload === 'object' && 'conversation_id' in payload) {
              refreshMessage(`/conversation/${payload.conversation_id}`);
            }
          }
        })
      .subscribe();
    return () => { active = false; removePushListeners(); void supabase?.removeChannel(channel); };
  }, [userId, queryClient]);
}
