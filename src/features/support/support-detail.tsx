import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppScreen, EmptyState, PrimaryButton } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { SUPPORT_CATEGORIES, SUPPORT_STATUS_LABELS } from '@/constants/support';
import { supabase } from '@/services/supabase/client';

export function SupportDetail({ admin = false }: { admin?: boolean }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const request = useQuery({
    queryKey: ['support-request', id], enabled: Boolean(supabase && id),
    queryFn: async () => {
      if (!supabase || !id) return null;
      const { data, error } = await supabase.from('support_requests').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    let active = true;
    const path = request.data?.screenshot_path;
    if (path && supabase) {
      void supabase.storage.from('support-screenshots').createSignedUrl(path, 300).then(({ data }) => {
        if (active) setImageUrl(data?.signedUrl ?? null);
      });
    }
    return () => { active = false; };
  }, [request.data?.screenshot_path]);

  async function setStatus(status: 'in_progress' | 'resolved' | 'closed') {
    if (!supabase || !id || busy) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.from('support_requests').update({ status }).eq('id', id);
    if (error) setMessage('Impossible de mettre à jour la demande.');
    else {
      await queryClient.invalidateQueries({ queryKey: ['support-request', id] });
      await queryClient.invalidateQueries({ queryKey: ['support-requests'] });
    }
    setBusy(false);
  }

  const item = request.data;
  return <AppScreen title="Demande de support">
    {request.isPending ? <ActivityIndicator color={colors.blue} /> : request.error || !item
      ? <EmptyState icon="lock-closed-outline" title="Demande inaccessible" description="Cette demande n’existe pas ou vous n’y avez pas accès." />
      : <View style={styles.card}>
        <Text style={styles.title}>{item.subject}</Text>
        <Text style={styles.meta}>{SUPPORT_CATEGORIES.find((value) => value.value === item.category)?.label ?? item.category}</Text>
        <Text style={styles.meta}>{new Date(item.created_at).toLocaleString('fr-FR')} · {SUPPORT_STATUS_LABELS[item.status] ?? item.status}</Text>
        <Text style={styles.description}>{item.description}</Text>
        {imageUrl && <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" />}
        {admin && <>
          <Text style={styles.label}>Informations de contact</Text>
          <Text style={styles.meta}>{item.contact_email}</Text>
          <Text style={styles.meta}>Utilisateur : {item.user_id}</Text>
          <Text style={styles.label}>Informations techniques</Text>
          <Text style={styles.meta}>{item.platform} · Artiz {item.app_version}</Text>
          {item.device_info && <Text style={styles.meta}>{item.device_info}</Text>}
          {item.screen_path && <Text style={styles.meta}>Écran : {item.screen_path}</Text>}
          <Text style={styles.label}>Traitement</Text>
          {item.status === 'open' && <PrimaryButton title="Prendre en charge" disabled={busy} onPress={() => void setStatus('in_progress')} />}
          {item.status !== 'resolved' && item.status !== 'closed' && <PrimaryButton title="Marquer comme résolue" outline disabled={busy} onPress={() => void setStatus('resolved')} />}
          {item.status !== 'closed' && <PrimaryButton title="Clore la demande" outline disabled={busy} onPress={() => void setStatus('closed')} />}
          {message && <Text style={styles.error}>{message}</Text>}
        </>}
      </View>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 20, gap: 12 },
  title: { color: colors.navy, fontWeight: '700', fontSize: 19 },
  label: { color: colors.navy, fontWeight: '700', marginTop: 8 },
  meta: { color: colors.muted, lineHeight: 20 },
  description: { color: colors.navy, fontSize: 15, lineHeight: 23, marginTop: 6 },
  image: { width: '100%', height: 280, borderRadius: 12, backgroundColor: colors.pale },
  error: { color: colors.red ?? '#B42318' },
});
