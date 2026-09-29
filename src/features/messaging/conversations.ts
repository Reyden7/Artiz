import { supabase } from '@/services/supabase/client';
import { logger } from '@/services/logger';

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

  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
    target_id: recipientId,
    contact_context: context,
    target_request_id: requestId ?? null,
  });
  if (error) { logger.error('conversation.create_failed', { error, context: { operation: 'open_conversation', step: context } }); throw error; }
  if (!data) throw new Error('Conversation indisponible.');
  return data;
}
