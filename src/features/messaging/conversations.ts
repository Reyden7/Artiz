import { supabase } from '@/services/supabase/client';

export type ConversationContext = 'profile' | 'post' | 'search' | 'quote' | 'request' | 'reply';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function openConversation(
  recipientId: string,
  context: ConversationContext,
  requestId?: string,
): Promise<string> {
  if (!supabase) throw new Error('Connexion à la base de données indisponible.');
  if (!uuidPattern.test(recipientId) || (requestId && !uuidPattern.test(requestId))) {
    throw new Error('Destinataire ou demande invalide.');
  }

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Connectez-vous pour envoyer un message.');
  const userId = auth.user.id;
  if (userId === recipientId) throw new Error('Vous ne pouvez pas vous contacter vous-même.');

  async function findExisting() {
    const forward = supabase!.from('conversations').select('id')
      .eq('created_by', userId).eq('recipient_id', recipientId);
    const reverse = supabase!.from('conversations').select('id')
      .eq('created_by', recipientId).eq('recipient_id', userId);
    const [first, second] = await Promise.all([
      requestId ? forward.eq('request_id', requestId).maybeSingle() : forward.is('request_id', null).maybeSingle(),
      requestId ? reverse.eq('request_id', requestId).maybeSingle() : reverse.is('request_id', null).maybeSingle(),
    ]);
    if (first.error) throw first.error;
    if (second.error) throw second.error;
    return first.data?.id ?? second.data?.id ?? null;
  }

  const existing = await findExisting();
  if (existing) return existing;

  const { data, error } = await supabase.from('conversations').insert({
    created_by: userId,
    recipient_id: recipientId,
    context,
    request_id: requestId ?? null,
  }).select('id').single();
  if (error?.code === '23505') {
    const concurrent = await findExisting();
    if (concurrent) return concurrent;
  }
  if (error) throw error;
  return data.id;
}
