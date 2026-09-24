import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { AppScreen, Field, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { openConversation } from '@/features/messaging/conversations';
import { supabase } from '@/services/supabase/client';

export default function QuoteScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [project, setProject] = useState('');
  const [city, setCity] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const { session } = useAuth();

  async function submit() {
    if (!supabase || !session || !id || busy) return;
    setBusy(true);
    try {
      let requestId = pendingRequestId;
      if (!requestId) {
        const { data, error } = await supabase.from('service_requests').insert({
          customer_id: session.user.id,
          title: project.trim(),
          description: details.trim(),
          city: city.trim(),
          status: 'open',
          visibility: 'private',
          recipient_id: id,
        }).select('id').single();
        if (error) throw error;
        requestId = data.id;
        setPendingRequestId(requestId);
      } else {
        const { error } = await supabase.from('service_requests').update({
          title: project.trim(), description: details.trim(), city: city.trim(),
        }).eq('id', requestId);
        if (error) throw error;
      }
      const conversationId = await openConversation(id, 'quote', requestId);
      const { error: messageError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: session.user.id,
        body: `Demande de devis : ${project.trim()}\n${details.trim()}`,
      });
      if (messageError) throw messageError;
      router.replace(`/conversation/${conversationId}`);
    } catch (error) {
      Alert.alert('Demande non envoyée', error instanceof Error ? error.message : 'Réessayez plus tard.');
    } finally {
      setBusy(false);
    }
  }

  return <AppScreen title="Demande de devis" subtitle="Décrivez votre projet pour préparer une demande personnalisée.">
    {!id && <View style={styles.notice}><Text style={styles.noticeTitle}>Aucun professionnel sélectionné</Text><Text style={styles.meta}>Choisissez un professionnel avant d’envoyer votre demande.</Text><Pressable onPress={() => router.replace('/explore')} accessibilityRole="link"><Text style={styles.link}>Découvrir les artisans ›</Text></Pressable></View>}
    <View style={styles.form}>
      <Text style={styles.heading}>Votre projet</Text>
      <Field label="Type de projet *" value={project} onChangeText={setProject} placeholder="Type de réalisation souhaitée" />
      <Field label="Ville du projet *" value={city} onChangeText={setCity} placeholder="Ville ou code postal" />
      <Field label="Décrivez votre besoin *" value={details} onChangeText={setDetails} placeholder="Dimensions, style, matériaux souhaités…" multiline maxLength={800} />
      <Text style={styles.counter}>{details.length} / 800</Text>
      <PrimaryButton title={busy ? 'Envoi…' : 'Envoyer ma demande'} icon="paper-plane-outline" disabled={busy || !id || project.trim().length < 5 || !city.trim() || details.trim().length < 10} onPress={submit} />
      <Text style={styles.privacy}>La demande sera adressée au professionnel que vous aurez choisi.</Text>
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  notice: { backgroundColor: colors.backgroundWarm, borderRadius: 16, padding: 16, gap: 8 },
  noticeTitle: { color: colors.navy, fontSize: 16, fontWeight: '700' },
  link: { color: colors.blue, fontSize: 14, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  form: { backgroundColor: colors.white, borderColor: colors.divider, borderWidth: 1, borderRadius: 16, padding: 16, gap: 16 },
  heading: { color: colors.navy, fontSize: 20, fontWeight: '700' },
  counter: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: -12 },
  privacy: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
