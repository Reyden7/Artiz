import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { AppScreen, Avatar, EmptyState, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAccountType } from '@/features/auth/use-account-type';
import { openConversation } from '@/features/messaging/conversations';
import { supabase } from '@/services/supabase/client';

export default function ProfessionalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const account = useAccountType();
  const [busy, setBusy] = useState(false);
  const professional = useQuery({
    queryKey: ['professional', id],
    enabled: Boolean(supabase && id),
    queryFn: async () => {
      if (!supabase || !id) return null;
      const { data: business, error } = await supabase.from('professional_profiles')
        .select('user_id,business_name,headline,description,city,service_radius_km')
        .eq('user_id', id).eq('verification_status', 'verified').maybeSingle();
      if (error) throw error;
      if (!business) return null;
      const { data: owner, error: ownerError } = await supabase.from('profiles')
        .select('display_name').eq('id', id).single();
      if (ownerError) throw ownerError;
      return { ...business, displayName: owner.display_name };
    },
  });

  async function contact() {
    if (!id || busy) return;
    setBusy(true);
    try {
      const conversationId = await openConversation(id, 'profile');
      router.push(`/conversation/${conversationId}`);
    } catch (error) {
      Alert.alert('Contact impossible', error instanceof Error ? error.message : 'Réessayez plus tard.');
    } finally {
      setBusy(false);
    }
  }

  return <AppScreen title="Profil professionnel">
    {professional.isPending ? <ActivityIndicator color={colors.blue} /> : professional.error || !professional.data
      ? <EmptyState icon="person-outline" title="Profil indisponible" description="Ce profil professionnel n’est pas disponible pour le moment." action="Découvrir les artisans" onPress={() => router.replace('/explore')} />
      : <View style={styles.card}>
        <Avatar name={professional.data.displayName || professional.data.business_name} size={72} />
        <Text style={styles.title}>{professional.data.business_name}</Text>
        {professional.data.headline ? <Text style={styles.headline}>{professional.data.headline}</Text> : null}
        <Text style={styles.meta}>{professional.data.displayName}{professional.data.city ? ` · ${professional.data.city}` : ''}</Text>
        {professional.data.description ? <Text style={styles.description}>{professional.data.description}</Text> : null}
        {account.data === 'customer' && <View style={styles.actions}>
          <PrimaryButton title={busy ? 'Ouverture…' : 'Contacter'} icon="chatbubble-ellipses-outline" onPress={contact} disabled={busy} />
          <PrimaryButton title="Demander un devis" icon="document-text-outline" outline onPress={() => router.push(`/quote?id=${id}`)} />
        </View>}
      </View>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 20, alignItems: 'center', gap: 12 },
  title: { fontSize: 22, color: colors.navy, fontWeight: '700', textAlign: 'center' },
  headline: { color: colors.blue, textAlign: 'center' },
  meta: { color: colors.muted, textAlign: 'center' },
  description: { color: colors.navy, lineHeight: 22, alignSelf: 'stretch' },
  actions: { width: '100%', gap: 10, marginTop: 10 },
});
