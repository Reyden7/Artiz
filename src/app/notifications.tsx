import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppScreen, EmptyState } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/services/supabase/client';
import type { Json } from '@/services/supabase/database.types';

function destination(kind: string, payload: Json) {
  const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  if (kind === 'new_message' && typeof data.conversation_id === 'string') {
    return `/conversation/${data.conversation_id}` as const;
  }
  if (kind === 'professional_pending') return '/admin/professionals' as const;
  if (kind === 'request_response') return '/requests' as const;
  return null;
}

function label(kind: string) {
  if (kind === 'new_message') return 'Nouveau message';
  if (kind === 'request_response') return 'Un professionnel a répondu à votre besoin';
  if (kind === 'professional_pending') return 'Nouveau professionnel à valider';
  return 'Nouvelle activité';
}

export default function NotificationsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: ['my-notifications', userId, 'list'],
    enabled: Boolean(supabase && userId),
    queryFn: async () => {
      if (!supabase || !userId) return [];
      const { data, error } = await supabase.from('notifications')
        .select('id,kind,payload,read_at,created_at')
        .eq('recipient_id', userId).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  async function open(item: NonNullable<typeof notifications.data>[number]) {
    if (!supabase || !userId) return;
    if (!item.read_at) {
      const { error } = await supabase.from('notifications')
        .update({ read_at: new Date().toISOString() }).eq('id', item.id);
      if (!error) await queryClient.invalidateQueries({ queryKey: ['my-notifications', userId] });
    }
    const route = destination(item.kind, item.payload);
    if (route) router.push(route);
  }

  return <AppScreen title="Notifications">
    {notifications.isPending ? <ActivityIndicator color={colors.blue} /> : notifications.error
      ? <EmptyState icon="alert-circle-outline" title="Notifications indisponibles" description="Réessayez dans un instant." />
      : !notifications.data?.length
        ? <EmptyState icon="notifications-outline" title="Aucune notification" description="Les nouvelles de votre réseau apparaîtront ici." />
        : notifications.data.map((item) => <Pressable key={item.id} onPress={() => void open(item)} style={[styles.item, !item.read_at && styles.unread]} accessibilityRole="button">
          <View style={styles.text}><Text style={styles.title}>{label(item.kind)}</Text><Text style={styles.date}>{new Date(item.created_at).toLocaleString('fr-FR')}</Text></View>
          {!item.read_at && <View style={styles.dot} />}
        </Pressable>)}
  </AppScreen>;
}

const styles = StyleSheet.create({
  item: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 16, minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12 },
  unread: { borderColor: colors.blue },
  text: { flex: 1, gap: 5 },
  title: { color: colors.navy, fontWeight: '700', fontSize: 16 },
  date: { color: colors.muted, fontSize: 13 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange },
});
