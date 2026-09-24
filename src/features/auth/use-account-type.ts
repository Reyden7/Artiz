import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/services/supabase/client';

export function useAccountType() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['account-type', session?.user.id],
    enabled: Boolean(supabase && session?.user.id),
    queryFn: async () => {
      if (!supabase || !session) return null;
      const { data, error } = await supabase.from('profiles')
        .select('account_type').eq('id', session.user.id).single();
      if (error) throw error;
      return data.account_type;
    },
  });
}
