import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/services/supabase/client';

export function useUnreadMessages() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['unread-message-counts', session?.user.id],
    enabled: Boolean(supabase && session),
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.rpc('unread_message_counts');
      if (error) throw error;
      return data;
    },
  });
}
