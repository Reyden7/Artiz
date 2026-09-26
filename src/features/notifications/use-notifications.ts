import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/services/supabase/client';

export function useUnreadNotifications() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['my-notifications', userId, 'unread'],
    enabled: Boolean(supabase && userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!supabase || !userId) return 0;
      const { count, error } = await supabase.from('notifications')
        .select('id', { head: true, count: 'exact' }).eq('recipient_id', userId).is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
