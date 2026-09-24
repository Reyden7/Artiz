import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { AppScreen, EmptyState, Field, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/services/supabase/client';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const conversation = useQuery({
    queryKey: ['conversation', id, session?.user.id],
    enabled: Boolean(supabase && id && session),
    queryFn: async () => {
      if (!supabase || !id || !session) return null;
      const { data, error } = await supabase.from('conversations')
        .select('id,created_by,recipient_id').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const peerId = data.created_by === session.user.id ? data.recipient_id : data.created_by;
      const { data: peer, error: peerError } = await supabase.from('profiles')
        .select('display_name').eq('id', peerId).single();
      if (peerError) throw peerError;
      return { id: data.id, peerName: peer.display_name || 'Membre Artiz' };
    },
  });
  const messages = useQuery({
    queryKey: ['conversation-messages', id],
    enabled: Boolean(supabase && id && conversation.data),
    refetchInterval: 4_000,
    queryFn: async () => {
      if (!supabase || !id) return [];
      const { data, error } = await supabase.from('messages')
        .select('id,sender_id,body,created_at').eq('conversation_id', id)
        .order('created_at', { ascending: true }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  async function send() {
    const content = body.trim();
    if (!supabase || !session || !id || !content || busy) return;
    setBusy(true);
    const { error } = await supabase.from('messages').insert({ conversation_id: id, sender_id: session.user.id, body: content });
    setBusy(false);
    if (error) Alert.alert('Message non envoyé', error.message);
    else {
      setBody('');
      await queryClient.invalidateQueries({ queryKey: ['conversation-messages', id] });
    }
  }

  return <AppScreen title={conversation.data?.peerName ?? 'Conversation'}>
    {conversation.isPending ? <ActivityIndicator color={colors.blue} /> : conversation.error || !conversation.data
      ? <EmptyState icon="chatbubble-ellipses-outline" title="Conversation indisponible" description="Cette conversation n’est pas accessible avec votre compte." action="Voir mes messages" onPress={() => router.replace('/messages')} />
      : <>
        {messages.isPending ? <ActivityIndicator color={colors.blue} /> : messages.error
          ? <Text style={styles.error}>Impossible de charger les messages.</Text>
          : messages.data.length === 0
            ? <Text style={styles.intro}>Présentez votre projet et commencez la discussion.</Text>
            : messages.data.map((message) => <View key={message.id} style={[styles.bubble, message.sender_id === session?.user.id ? styles.mine : styles.theirs]}>
              <Text style={[styles.message, message.sender_id === session?.user.id && styles.mineText]}>{message.body}</Text>
              <Text style={[styles.time, message.sender_id === session?.user.id && styles.mineText]}>{new Date(message.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>)}
        <View style={styles.composer}><Field label="Votre message" value={body} onChangeText={setBody} placeholder="Écrire un message…" multiline maxLength={5000} /><PrimaryButton title={busy ? 'Envoi…' : 'Envoyer'} icon="send-outline" onPress={send} disabled={busy || !body.trim()} /></View>
      </>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', borderRadius: 14, padding: 12, gap: 6 },
  mine: { backgroundColor: colors.blue, alignSelf: 'flex-end' },
  theirs: { backgroundColor: colors.pale, alignSelf: 'flex-start' },
  message: { color: colors.navy, lineHeight: 21 },
  mineText: { color: colors.white },
  time: { color: colors.muted, fontSize: 11, alignSelf: 'flex-end' },
  composer: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, padding: 14, gap: 12 },
  intro: { color: colors.muted, textAlign: 'center' },
  error: { color: colors.red },
});
