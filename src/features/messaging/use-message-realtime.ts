import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase/client';

export function useMessageRealtime(userId?: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!supabase || !userId) return;
    const client = supabase;
    const refreshInbox = () => {
      void queryClient.invalidateQueries({ queryKey: ['unread-message-counts', userId] });
      void queryClient.invalidateQueries({ queryKey: ['my-conversations', userId] });
    };
    const channel = client.channel(`artiz-inbox-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (event) => {
        const conversationId = event.new.conversation_id;
        if (typeof conversationId === 'string') {
          void queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
        }
        refreshInbox();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${userId}` }, refreshInbox)
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [userId, queryClient]);
}
