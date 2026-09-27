import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { Avatar, EmptyState, MainScreen } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { useUnreadMessages } from '@/features/messaging/use-unread-messages';
import { supabase } from '@/services/supabase/client';

export default function MessagesScreen() {
  const { session } = useAuth();
  const unread = useUnreadMessages();
  const unreadByConversation = new Map((unread.data ?? []).map((item) => [item.conversation_id, item.unread_count]));
  const conversations = useQuery({
    queryKey: ['my-conversations', session?.user.id],
    enabled: Boolean(supabase && session),
    queryFn: async () => {
      if (!supabase || !session) return [];
      const { data, error } = await supabase.rpc('list_my_direct_conversations');
      if (error) throw error;
      return data;
    },
  });
  return <MainScreen title="Messages" subtitle="Échangez simplement autour de vos projets.">
    {conversations.isPending ? <ActivityIndicator color={colors.blue} /> : conversations.error
      ? <EmptyState icon="alert-circle-outline" title="Messages indisponibles" description="Impossible de charger les conversations pour le moment." />
      : conversations.data.length === 0
        ? <EmptyState icon="chatbubble-ellipses-outline" title="Aucune conversation" description="Vos échanges avec les professionnels apparaîtront ici." action="Découvrir les artisans" onPress={() => router.replace('/explore')} />
        : conversations.data.map((thread) => <Pressable key={thread.id} onPress={() => router.push(`/conversation/${thread.id}`)} accessibilityRole="button" style={styles.row}>
          <Avatar name={thread.peer_name} />
          <View style={styles.rowBody}><Text style={styles.name}>{thread.peer_name}</Text><Text style={styles.meta} numberOfLines={1}>{thread.last_message_body ?? 'Commencer la conversation'}</Text><Text style={styles.meta}>{new Date(thread.last_message_at ?? thread.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</Text></View>
          {Boolean(unreadByConversation.get(thread.id)) && <View style={styles.unread}><Text style={styles.unreadText}>{unreadByConversation.get(thread.id)}</Text></View>}
          <Text style={styles.arrow}>›</Text>
        </Pressable>)}
  </MainScreen>;
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 14, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBody: { flex: 1, gap: 3 },
  name: { color: colors.navy, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13 },
  unread: { backgroundColor: colors.orange, minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  arrow: { color: colors.blue, fontSize: 22 },
});
