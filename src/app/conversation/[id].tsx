import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { AppScreen, EmptyState, Field, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/services/supabase/client';
import { logger } from '@/services/logger';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const lastMarkedMessage = useRef<string | null>(null);
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
    queryKey: ['conversation-messages', id, session?.user.id],
    enabled: Boolean(supabase && id && conversation.data),
    queryFn: async () => {
      if (!supabase || !id) return [];
      const { data, error } = await supabase.from('messages')
        .select('id,sender_id,body,created_at,service_request_id').eq('conversation_id', id)
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      const requestIds = [...new Set(data.map((message) => message.service_request_id).filter((value): value is string => Boolean(value)))];
      const requests = requestIds.length ? await supabase.from('service_requests')
        .select('id,title,visibility').in('id', requestIds) : { data: [], error: null };
      if (requests.error) throw requests.error;
      const contexts = new Map(requests.data.map((request) => [request.id, request]));
      return data.reverse().map((message) => ({ ...message,
        request: message.service_request_id ? contexts.get(message.service_request_id) ?? null : null }));
    },
  });

  useEffect(() => {
    if (!supabase || !session || !id || !conversation.data || !messages.data?.length) return;
    const newest = messages.data[messages.data.length - 1];
    if (lastMarkedMessage.current === newest.id) return;
    lastMarkedMessage.current = newest.id;
    void supabase.rpc('mark_conversation_read', {
      target_conversation: id,
      through_message: newest.id,
    }).then(({ error }) => {
      if (error) lastMarkedMessage.current = null;
      else void queryClient.invalidateQueries({ queryKey: ['unread-message-counts', session.user.id] });
    });
  }, [conversation.data, id, messages.data, queryClient, session]);

  async function send() {
    const content = body.trim();
    if (!supabase || !session || !id || !content || busy) return;
    setBusy(true);
    const { error } = await supabase.from('messages').insert({ conversation_id: id, sender_id: session.user.id, body: content });
    setBusy(false);
    if (error) { logger.error('message.send_failed', { error, context: { operation: 'send_message' }, correlationId: logger.newCorrelationId() }); Alert.alert('Message non envoyé', error.message); }
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
              {message.request && <Text style={[styles.context, message.sender_id === session?.user.id && styles.mineText]}>{message.request.visibility === 'private' ? 'Demande de devis' : 'Demande de service'} — {message.request.title}</Text>}
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
  context: { color: colors.blue, fontWeight: '700', fontSize: 12 },
  mineText: { color: colors.white },
  time: { color: colors.muted, fontSize: 11, alignSelf: 'flex-end' },
  composer: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, padding: 14, gap: 12 },
  intro: { color: colors.muted, textAlign: 'center' },
  error: { color: colors.red },
});
