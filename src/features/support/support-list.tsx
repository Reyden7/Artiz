import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppScreen, EmptyState } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { SUPPORT_STATUS_LABELS } from '@/constants/support';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/services/supabase/client';

export function SupportList({ admin = false }: { admin?: boolean }) {
  const { session } = useAuth();
  const requests = useQuery({
    queryKey: ['support-requests', admin ? 'admin' : session?.user.id],
    enabled: Boolean(supabase && session),
    queryFn: async () => {
      if (!supabase || !session) return [];
      let query = supabase.from('support_requests')
        .select('id,subject,category,status,created_at,contact_email').order('created_at', { ascending: false }).limit(100);
      if (!admin) query = query.eq('user_id', session.user.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return <AppScreen title={admin ? 'Demandes de support' : 'Mes demandes de support'}>
    {requests.isPending ? <ActivityIndicator color={colors.blue} /> : requests.error
      ? <EmptyState icon="alert-circle-outline" title="Demandes indisponibles" description="Réessayez dans un instant." />
      : !requests.data?.length
        ? <EmptyState icon="help-circle-outline" title="Aucune demande" description={admin ? 'Les nouvelles demandes apparaîtront ici.' : 'Vos signalements apparaîtront ici.'} />
        : requests.data.map((item) => <Pressable key={item.id} style={styles.row} accessibilityRole="button"
          onPress={() => router.push(admin
            ? { pathname: '/admin/support/[id]', params: { id: item.id } }
            : { pathname: '/settings/support/[id]', params: { id: item.id } })}>
          <View style={styles.text}>
            <Text style={styles.title}>{item.subject}</Text>
            <Text style={styles.meta}>{new Date(item.created_at).toLocaleDateString('fr-FR')} · {SUPPORT_STATUS_LABELS[item.status] ?? item.status}</Text>
            {admin && <Text style={styles.meta}>{item.contact_email}</Text>}
          </View><Text style={styles.arrow}>›</Text>
        </Pressable>)}
  </AppScreen>;
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, padding: 18, minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text: { flex: 1, gap: 5 }, title: { color: colors.navy, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13 }, arrow: { color: colors.blue, fontSize: 24 },
});
