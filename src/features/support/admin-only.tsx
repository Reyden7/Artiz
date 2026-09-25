import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator } from 'react-native';
import { AppScreen, EmptyState } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/services/supabase/client';

export function AdminOnlySupport({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const access = useQuery({
    queryKey: ['support-admin-access', session?.user.id],
    enabled: Boolean(supabase && session),
    queryFn: async () => {
      if (!supabase) return false;
      const { data, error } = await supabase.rpc('is_artiz_admin_self');
      if (error) throw error;
      return data;
    },
  });
  if (access.isPending) return <AppScreen><ActivityIndicator color={colors.blue} /></AppScreen>;
  if (access.error || !access.data) return <AppScreen><EmptyState icon="lock-closed-outline"
    title="Accès réservé" description="Cette page est réservée au support Artiz." /></AppScreen>;
  return children;
}
