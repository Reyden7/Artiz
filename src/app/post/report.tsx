import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { AppScreen, Field, PrimaryButton } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/services/supabase/client';

export default function ReportPostScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!supabase || !session || !id || busy) return;
    if (reason.trim().length < 5) { Alert.alert('Précisez le problème', 'Décrivez le motif en quelques mots.'); return; }
    setBusy(true);
    const { error } = await supabase.from('reports').insert({ reporter_id: session.user.id, target_post_id: id, reason: reason.trim() });
    setBusy(false);
    if (error) Alert.alert('Signalement impossible', 'Réessayez plus tard.');
    else { Alert.alert('Signalement envoyé', 'Merci, nous examinerons cette publication.'); router.back(); }
  }
  return <AppScreen title="Signaler une publication"><View style={styles.card}>
    <Text style={styles.hint}>Décrivez le contenu qui vous semble problématique. Votre signalement sera examiné par l’équipe Artiz.</Text>
    <Field label="Motif" value={reason} onChangeText={setReason} multiline maxLength={1000} placeholder="Pourquoi signalez-vous cette publication ?" />
    <PrimaryButton title={busy ? 'Envoi…' : 'Envoyer le signalement'} onPress={() => void submit()} disabled={busy || reason.trim().length < 5} />
  </View></AppScreen>;
}
const styles = StyleSheet.create({ card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.divider, padding: 16, gap: 16 }, hint: { color: colors.muted, lineHeight: 21 } });
