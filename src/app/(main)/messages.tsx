import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { Avatar, EmptyState, MainScreen } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { useUnreadMessages } from '@/features/messaging/use-unread-messages';
import { supabase } from '@/services/supabase/client';

export default function MessagesScreen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [hideError, setHideError] = useState<string | null>(null);
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

  async function hideConversation(conversationId: string) {
    if (!supabase || !session || hidingId) return;
    setHidingId(conversationId);
    setHideError(null);
    try {
      const { data, error } = await supabase.from('conversation_members')
        .update({ hidden_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', session.user.id)
        .select('conversation_id');
      if (error || !data?.length) throw error ?? new Error('Conversation indisponible');
      setConfirmId(null);
      setMenuId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-conversations', session.user.id] }),
        queryClient.invalidateQueries({ queryKey: ['unread-message-counts', session.user.id] }),
      ]);
    } catch {
      setHideError('Impossible de supprimer cette conversation de votre liste. Réessayez.');
    } finally {
      setHidingId(null);
    }
  }

  return <MainScreen title="Messages" subtitle="Échangez simplement autour de vos projets.">
    {conversations.isPending ? <ActivityIndicator color={colors.blue} /> : conversations.error
      ? <EmptyState icon="alert-circle-outline" title="Messages indisponibles" description="Impossible de charger les conversations pour le moment." />
      : conversations.data.length === 0
        ? <EmptyState icon="chatbubble-ellipses-outline" title="Aucune conversation" description="Vos échanges avec les professionnels apparaîtront ici." action="Découvrir les artisans" onPress={() => router.replace('/explore')} />
        : conversations.data.map((thread) => <View key={thread.id} style={styles.thread}>
          <View style={styles.row}>
            <Pressable onPress={() => router.push(`/conversation/${thread.id}`)} accessibilityRole="button" accessibilityLabel={`Ouvrir la conversation avec ${thread.peer_name}`} style={styles.openRow}>
              <Avatar name={thread.peer_name} />
              <View style={styles.rowBody}><Text style={styles.name}>{thread.peer_name}</Text><Text style={styles.meta} numberOfLines={1}>{thread.last_message_body ?? 'Commencer la conversation'}</Text><Text style={styles.meta}>{new Date(thread.last_message_at ?? thread.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</Text></View>
              {Boolean(unreadByConversation.get(thread.id)) && <View style={styles.unread}><Text style={styles.unreadText}>{unreadByConversation.get(thread.id)}</Text></View>}
            </Pressable>
            <Pressable onPress={() => { setMenuId(menuId === thread.id ? null : thread.id); setConfirmId(null); setHideError(null); }} accessibilityRole="button" accessibilityLabel={`Options de la conversation avec ${thread.peer_name}`} style={styles.moreButton}>
              <Text style={styles.moreText}>⋯</Text>
            </Pressable>
          </View>
          {menuId === thread.id && !confirmId && <Pressable style={styles.menuAction} onPress={() => setConfirmId(thread.id)} accessibilityRole="button">
            <Text style={styles.deleteText}>Supprimer la conversation</Text>
          </Pressable>}
          {confirmId === thread.id && <View style={styles.confirmation}>
            <Text style={styles.confirmTitle}>Supprimer cette conversation de votre liste ?</Text>
            <Text style={styles.meta}>L’autre participant conservera l’historique.</Text>
            {hideError && <Text style={styles.deleteText}>{hideError}</Text>}
            <View style={styles.confirmActions}>
              <Pressable onPress={() => { setConfirmId(null); setMenuId(null); setHideError(null); }} disabled={hidingId === thread.id} accessibilityRole="button" style={styles.actionButton}><Text style={styles.actionText}>Annuler</Text></Pressable>
              <Pressable onPress={() => { void hideConversation(thread.id); }} disabled={hidingId === thread.id} accessibilityRole="button" style={styles.actionButton}><Text style={styles.deleteText}>{hidingId === thread.id ? 'Suppression…' : 'Supprimer'}</Text></Pressable>
            </View>
          </View>}
        </View>)}
  </MainScreen>;
}

const styles = StyleSheet.create({
  thread: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, overflow: 'hidden' },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center' },
  openRow: { flex: 1, minWidth: 0, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  moreButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: colors.blue, fontSize: 26, lineHeight: 30 },
  menuAction: { borderTopWidth: 1, borderTopColor: colors.divider, paddingHorizontal: 16, paddingVertical: 14 },
  confirmation: { borderTopWidth: 1, borderTopColor: colors.divider, padding: 16, gap: 8 },
  confirmTitle: { color: colors.navy, fontSize: 15, fontWeight: '700' },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  actionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  actionText: { color: colors.blue, fontWeight: '700' },
  deleteText: { color: colors.red, fontWeight: '700' },
  rowBody: { flex: 1, gap: 3 },
  name: { color: colors.navy, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13 },
  unread: { backgroundColor: colors.orange, minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { color: colors.white, fontWeight: '700', fontSize: 12 },
});
