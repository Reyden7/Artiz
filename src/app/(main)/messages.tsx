import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { Avatar, EmptyState, MainScreen } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/services/supabase/client';

export default function MessagesScreen() {
  const { session } = useAuth();
  const conversations = useQuery({
    queryKey: ['my-conversations', session?.user.id],
    enabled: Boolean(supabase && session),
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!supabase || !session) return [];
      const { data: memberships, error: membershipError } = await supabase.from('conversation_members')
        .select('conversation_id').eq('user_id', session.user.id);
      if (membershipError) throw membershipError;
      if (!memberships.length) return [];
      const { data: threads, error: threadError } = await supabase.from('conversations')
        .select('id,created_by,recipient_id,created_at')
        .in('id', memberships.map((member) => member.conversation_id))
        .order('created_at', { ascending: false });
      if (threadError) throw threadError;
      const peerIds = threads.map((thread) => thread.created_by === session.user.id ? thread.recipient_id : thread.created_by);
      const { data: people, error: peopleError } = await supabase.from('profiles')
        .select('id,display_name').in('id', peerIds);
      if (peopleError) throw peopleError;
      const names = new Map(people.map((person) => [person.id, person.display_name]));
      return threads.map((thread) => {
        const peerId = thread.created_by === session.user.id ? thread.recipient_id : thread.created_by;
        return { id: thread.id, name: names.get(peerId) || 'Membre Artiz', createdAt: thread.created_at };
      });
    },
  });
  return <MainScreen title="Messages" subtitle="Échangez simplement autour de vos projets.">
    {conversations.isPending ? <ActivityIndicator color={colors.blue} /> : conversations.error
      ? <EmptyState icon="alert-circle-outline" title="Messages indisponibles" description="Impossible de charger les conversations pour le moment." />
      : conversations.data.length === 0
        ? <EmptyState icon="chatbubble-ellipses-outline" title="Aucune conversation" description="Vos échanges avec les professionnels apparaîtront ici." action="Découvrir les artisans" onPress={() => router.replace('/explore')} />
        : conversations.data.map((thread) => <Pressable key={thread.id} onPress={() => router.push(`/conversation/${thread.id}`)} accessibilityRole="button" style={styles.row}>
          <Avatar name={thread.name} />
          <View style={styles.rowBody}><Text style={styles.name}>{thread.name}</Text><Text style={styles.meta}>Voir la conversation</Text></View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>)}
  </MainScreen>;
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 14, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBody: { flex: 1, gap: 3 },
  name: { color: colors.navy, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13 },
  arrow: { color: colors.blue, fontSize: 22 },
});
