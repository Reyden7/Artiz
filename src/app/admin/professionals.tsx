import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/typography';
import { AppScreen, Field, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { supabase } from '@/services/supabase/client';

type Review = {
  user_id: string;
  email: string;
  display_name: string;
  business_name: string;
  siret: string;
  legal_name: string | null;
  commune: string | null;
  postal_code: string | null;
  applied_at: string;
  registry_data: Record<string, string>;
};

async function errorMessage(error: { context?: unknown; message: string }) {
  const response = error.context;
  if (response instanceof Response) {
    try {
      const body = await response.json() as { error?: string };
      if (body.error) return body.error;
    } catch { /* Use the transport error below. */ }
  }
  return error.message;
}

export default function PendingProfessionalsScreen() {
  const [pending, setPending] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) return;
      const { data, error } = await supabase.functions.invoke('review-professionals', { method: 'GET' });
      if (!active) return;
      if (error) setMessage(await errorMessage(error));
      else { setPending((data as { pending: Review[] }).pending); setMessage(''); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  async function review(item: Review, decision: 'verified' | 'rejected') {
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase.functions.invoke('review-professionals', {
      body: { professionalId: item.user_id, decision, note: note.trim() },
    });
    if (error) setMessage(await errorMessage(error));
    else {
      setPending((current) => current.filter((candidate) => candidate.user_id !== item.user_id));
      setSelectedId(null);
      setChecked(false);
      setNote('');
      setMessage(decision === 'verified' ? 'Affiliation validée.' : 'Demande refusée.');
    }
    setBusy(false);
  }

  return <AppScreen title="Professionnels en attente" subtitle="Examinez chaque SIRET et validez manuellement les comptes professionnels.">
    <Pressable onPress={() => router.back()}><Text style={styles.link}>‹ Retour au profil</Text></Pressable>
    {loading && <ActivityIndicator color={colors.blue} />}
    {message ? <Text style={styles.message}>{message}</Text> : null}
    {!loading && pending.length === 0 && <View style={styles.card}><Text style={styles.meta}>Aucune demande en attente.</Text></View>}
    {pending.map((item) => {
      const selected = item.user_id === selectedId;
      const details = item.registry_data ?? {};
      return <View key={item.user_id} style={styles.card}>
        <Text style={styles.title}>{item.business_name}</Text>
        <Text style={styles.meta}>{item.display_name} · {item.email}</Text>
        <Text style={styles.detail}>SIRET : {item.siret}</Text>
        <Text style={styles.detail}>Raison sociale : {item.legal_name || 'Non disponible'}</Text>
        <Text style={styles.detail}>Commune : {item.commune || 'Non disponible'} {item.postal_code || ''}</Text>
        <Text style={styles.detail}>Demande : {new Date(item.applied_at).toLocaleDateString('fr-FR')}</Text>
        <View style={styles.registry}>
          <Text style={styles.registryTitle}>Données du registre</Text>
          <Text style={styles.meta}>Entreprise : {details.company_status === 'A' ? 'active' : details.company_status || 'à vérifier'}</Text>
          <Text style={styles.meta}>Établissement : {details.establishment_status === 'A' ? 'actif' : details.establishment_status || 'à vérifier'}</Text>
          <Text style={styles.meta}>Activité : {details.activity_code || 'Non disponible'}</Text>
          <Text style={styles.meta}>Source : {details.source || 'recherche-entreprises.api.gouv.fr'}</Text>
        </View>
        {!selected && <PrimaryButton title="Examiner la demande" onPress={() => { setSelectedId(item.user_id); setChecked(false); setNote(''); }} outline />}
        {selected && <>
          <Text style={styles.warning}>Le SIRET est contrôlé à nouveau dans le registre officiel au moment de la validation. Décidez après avoir examiné ces informations.</Text>
          <Pressable style={styles.confirm} onPress={() => setChecked((value) => !value)} accessibilityRole="checkbox" accessibilityState={{ checked }}>
            <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={colors.blue} />
            <Text style={styles.confirmText}>J’ai vérifié manuellement les informations de ce professionnel.</Text>
          </Pressable>
          <Field label="Note interne (facultative)" value={note} onChangeText={setNote} placeholder="Précision sur la décision" multiline maxLength={1000} />
          <PrimaryButton title={busy ? 'Enregistrement…' : 'Valider le professionnel'} onPress={() => void review(item, 'verified')} disabled={busy || !checked} />
          <PrimaryButton title={busy ? 'Enregistrement…' : 'Refuser'} onPress={() => void review(item, 'rejected')} disabled={busy} outline />
        </>}
      </View>;
    })}
  </AppScreen>;
}

const styles = StyleSheet.create({
  link: { color: colors.blue, fontWeight: '600' },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 18, gap: 10 },
  title: { color: colors.navy, fontSize: 20, fontWeight: '700' },
  meta: { color: colors.muted, lineHeight: 21 },
  detail: { color: colors.navy, lineHeight: 22 },
  registry: { backgroundColor: colors.pale, borderRadius: 10, padding: 12, gap: 4 },
  registryTitle: { color: colors.navy, fontWeight: '700' },
  warning: { color: colors.navy, backgroundColor: colors.backgroundWarm, padding: 12, borderRadius: 10, lineHeight: 21 },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  confirmText: { flex: 1, color: colors.navy, lineHeight: 21 },
  message: { color: colors.blue, backgroundColor: colors.pale, padding: 12, borderRadius: 10 },
});
