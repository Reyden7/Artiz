import { useState } from 'react';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { AppScreen, EmptyState, Field, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { useAccountType } from '@/features/auth/use-account-type';
import { openConversation } from '@/features/messaging/conversations';
import { supabase } from '@/services/supabase/client';

export default function RequestsScreen() {
  const { session } = useAuth();
  const account = useAccountType();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const professional = account.data === 'professional';
  const access = useQuery({
    queryKey: ['request-access', session?.user.id],
    enabled: Boolean(supabase && session && professional),
    queryFn: async () => {
      if (!supabase || !session) return { status: null as string | null, categoryIds: [] as string[] };
      const [profile, links] = await Promise.all([
        supabase.from('professional_profiles').select('verification_status').eq('user_id', session.user.id).single(),
        supabase.from('professional_category_links').select('category_id').eq('professional_id', session.user.id),
      ]);
      if (profile.error) throw profile.error;
      if (links.error) throw links.error;
      return { status: profile.data.verification_status, categoryIds: links.data.map((link) => link.category_id) };
    },
  });
  const requests = useQuery({
    queryKey: ['service-requests', session?.user.id, account.data, access.data?.categoryIds],
    enabled: Boolean(supabase && session && account.data && (!professional || access.data)),
    queryFn: async () => {
      if (!supabase || !session) return [];
      if (professional && (access.data?.status !== 'verified' || !access.data.categoryIds.length)) return [];
      let query = supabase.from('service_requests')
        .select('id,customer_id,title,description,city,category_id,budget_max_cents,desired_by,status,created_at')
        .order('created_at', { ascending: false }).limit(30);
      query = professional
        ? query.eq('visibility', 'public').eq('status', 'open').in('category_id', access.data!.categoryIds)
        : query.eq('customer_id', session.user.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  async function reply(requestId: string, customerId: string) {
    if (!supabase || !session || busy || response.trim().length < 10) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('service_request_responses').insert({
        request_id: requestId,
        professional_id: session.user.id,
        message: response.trim(),
      });
      if (error && error.code !== '23505') throw error;
      const conversationId = await openConversation(customerId, 'request', requestId);
      const { error: messageError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: session.user.id,
        body: response.trim(),
      });
      if (messageError) throw messageError;
      await queryClient.invalidateQueries({ queryKey: ['my-conversations'] });
      setSelectedId(null);
      setResponse('');
      router.push(`/conversation/${conversationId}`);
    } catch (error) {
      Alert.alert('Réponse non envoyée', error instanceof Error ? error.message : 'Réessayez plus tard.');
    } finally {
      setBusy(false);
    }
  }

  const loading = account.isPending || access.isPending && professional || requests.isPending;
  const error = account.error || access.error || requests.error;
  return <AppScreen title={professional ? 'Besoins des particuliers' : 'Mes besoins'} subtitle={professional ? 'Demandes ouvertes dans vos métiers.' : 'Retrouvez vos demandes publiées.'}>
    <Pressable onPress={() => router.back()}><Text style={styles.link}>‹ Retour</Text></Pressable>
    {loading ? <ActivityIndicator color={colors.blue} /> : error
      ? <EmptyState icon="alert-circle-outline" title="Demandes indisponibles" description="Impossible de charger les demandes pour le moment." />
      : professional && access.data?.status !== 'verified'
        ? <EmptyState icon="time-outline" title="Compte en attente" description="Les demandes seront accessibles après validation de votre compte professionnel." />
        : professional && !access.data?.categoryIds.length
          ? <EmptyState icon="list-outline" title="Choisissez vos métiers" description="Sélectionnez vos catégories dans votre profil pour voir les demandes correspondantes." action="Mon profil" onPress={() => router.replace('/profile')} />
          : !requests.data?.length
            ? <EmptyState icon="construct-outline" title="Aucune demande pour le moment" description={professional ? 'Les projets de vos catégories apparaîtront ici.' : 'Publiez un besoin pour commencer.'} action={professional ? undefined : 'Publier un besoin'} onPress={professional ? undefined : () => router.replace('/create')} />
            : requests.data.map((item) => <View key={item.id} style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>{item.city} · {new Date(item.created_at).toLocaleDateString('fr-FR')}</Text>
              <Text style={styles.body}>{item.description}</Text>
              {item.budget_max_cents !== null && <Text style={styles.meta}>Budget maximal : {Math.round(item.budget_max_cents / 100)} €</Text>}
              {item.desired_by && <Text style={styles.meta}>Date souhaitée : {item.desired_by}</Text>}
              {!professional && <Text style={styles.meta}>Statut : {item.status === 'open' ? 'Ouvert' : item.status}</Text>}
              {professional && selectedId !== item.id && <PrimaryButton title="Répondre à ce besoin" onPress={() => { setSelectedId(item.id); setResponse(''); }} outline />}
              {professional && selectedId === item.id && <>
                <Field label="Votre réponse" value={response} onChangeText={setResponse} placeholder="Expliquez comment vous pouvez accompagner ce projet…" multiline maxLength={2000} />
                <PrimaryButton title={busy ? 'Envoi…' : 'Envoyer et ouvrir la conversation'} onPress={() => void reply(item.id, item.customer_id)} disabled={busy || response.trim().length < 10} />
              </>}
            </View>)}
  </AppScreen>;
}

const styles = StyleSheet.create({
  link: { color: colors.blue, fontWeight: '600' },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 18, gap: 10 },
  title: { color: colors.navy, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.muted, lineHeight: 20 },
  body: { color: colors.navy, lineHeight: 22 },
});
