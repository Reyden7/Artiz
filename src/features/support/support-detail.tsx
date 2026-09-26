import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { AppScreen, EmptyState, Field, PrimaryButton } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, SUPPORT_STATUSES, SUPPORT_STATUS_LABELS, type SupportCategory, type SupportPriority, type SupportStatus } from '@/constants/support';
import { supabase } from '@/services/supabase/client';

type TicketDraft = {
  category: SupportCategory;
  subject: string;
  description: string;
  contact_email: string;
  status: SupportStatus;
  priority: SupportPriority;
};

export function SupportDetail({ admin = false }: { admin?: boolean }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<TicketDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    const { data, error } = await supabase.from('support_requests').update({ status }).eq('id', id).select('id').maybeSingle();
    if (error || !data) setMessage('Impossible de mettre à jour la demande.');
    else {
      await queryClient.invalidateQueries({ queryKey: ['support-request', id] });
      await queryClient.invalidateQueries({ queryKey: ['support-requests'] });
    }
    setBusy(false);
  }

  function startEditing() {
    if (!request.data) return;
    setMessage('');
    setConfirmDelete(false);
    setDraft({
      category: request.data.category as SupportCategory,
      subject: request.data.subject,
      description: request.data.description,
      contact_email: request.data.contact_email,
      status: request.data.status as SupportStatus,
      priority: request.data.priority as SupportPriority,
    });
  }

  async function saveChanges() {
    if (!supabase || !id || !draft || busy) return;
    const subject = draft.subject.trim();
    const description = draft.description.trim();
    const contactEmail = draft.contact_email.trim();
    if (subject.length < 3 || subject.length > 120 || description.length < 10 || description.length > 4000) {
      setMessage('Indiquez un sujet de 3 à 120 caractères et une description de 10 à 4 000 caractères.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setMessage('Vérifiez l’adresse e-mail de contact.');
      return;
    }
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase.from('support_requests').update({
      category: draft.category, subject, description, contact_email: contactEmail,
      status: draft.status, priority: draft.priority,
    }).eq('id', id).select('id').maybeSingle();
    if (error || !data) setMessage('Modification impossible. Rechargez la demande et réessayez.');
    else {
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ['support-request', id] });
      await queryClient.invalidateQueries({ queryKey: ['support-requests'] });
    }
    setBusy(false);
  }

  async function deleteRequest() {
    if (!supabase || !id || busy) return;
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase.from('support_requests').delete().eq('id', id)
      .select('id,screenshot_path').maybeSingle();
    if (error || !data) {
      setMessage('Suppression impossible. Rechargez la demande et réessayez.');
      setBusy(false);
      return;
    }
    let screenshotError = false;
    if (data.screenshot_path) {
      const result = await supabase.storage.from('support-screenshots').remove([data.screenshot_path]);
      screenshotError = Boolean(result.error);
    }
    queryClient.removeQueries({ queryKey: ['support-request', id] });
    await queryClient.invalidateQueries({ queryKey: ['support-requests'] });
    if (screenshotError) Alert.alert('Demande supprimée', 'La capture n’a pas pu être effacée du stockage. Contactez le support technique pour terminer son nettoyage.');
    router.replace('/admin/support' as Href);
  }

  const item = request.data;
  return <AppScreen title="Demande de support">
    {request.isPending ? <ActivityIndicator color={colors.blue} /> : request.error || !item
      ? <EmptyState icon="lock-closed-outline" title="Demande inaccessible" description="Cette demande n’existe pas ou vous n’y avez pas accès." />
      : <View style={styles.card}>
        <Text style={styles.title}>{item.subject}</Text>
        <Text style={styles.meta}>{SUPPORT_CATEGORIES.find((value) => value.value === item.category)?.label ?? item.category}</Text>
        <Text style={styles.meta}>{new Date(item.created_at).toLocaleString('fr-FR')} · {SUPPORT_STATUS_LABELS[item.status] ?? item.status}</Text>
        {admin && <Text style={styles.meta}>Priorité : {SUPPORT_PRIORITIES.find((value) => value.value === item.priority)?.label ?? item.priority}</Text>}
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
          {draft ? <>
            <Text style={styles.label}>Modifier la demande</Text>
            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.options}>{SUPPORT_CATEGORIES.map((option) => <Pressable key={option.value}
              style={[styles.option, draft.category === option.value && styles.optionSelected]}
              accessibilityRole="radio" accessibilityState={{ selected: draft.category === option.value }}
              onPress={() => setDraft({ ...draft, category: option.value })}>
              <Text style={[styles.optionText, draft.category === option.value && styles.optionTextSelected]}>{option.label}</Text>
            </Pressable>)}</View>
            <Field label="Sujet" value={draft.subject} onChangeText={(subject) => setDraft({ ...draft, subject })} maxLength={120} />
            <Field label="Description" value={draft.description} onChangeText={(description) => setDraft({ ...draft, description })} maxLength={4000} multiline />
            <Field label="E-mail de contact" value={draft.contact_email} onChangeText={(contact_email) => setDraft({ ...draft, contact_email })}
              maxLength={254} keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.label}>Statut</Text>
            <View style={styles.options}>{SUPPORT_STATUSES.map((option) => <Pressable key={option.value}
              style={[styles.option, draft.status === option.value && styles.optionSelected]}
              accessibilityRole="radio" accessibilityState={{ selected: draft.status === option.value }}
              onPress={() => setDraft({ ...draft, status: option.value })}>
              <Text style={[styles.optionText, draft.status === option.value && styles.optionTextSelected]}>{option.label}</Text>
            </Pressable>)}</View>
            <Text style={styles.label}>Priorité</Text>
            <View style={styles.options}>{SUPPORT_PRIORITIES.map((option) => <Pressable key={option.value}
              style={[styles.option, draft.priority === option.value && styles.optionSelected]}
              accessibilityRole="radio" accessibilityState={{ selected: draft.priority === option.value }}
              onPress={() => setDraft({ ...draft, priority: option.value })}>
              <Text style={[styles.optionText, draft.priority === option.value && styles.optionTextSelected]}>{option.label}</Text>
            </Pressable>)}</View>
            <PrimaryButton title={busy ? 'Enregistrement…' : 'Enregistrer les modifications'} disabled={busy} onPress={() => void saveChanges()} />
            <PrimaryButton title="Annuler" outline disabled={busy} onPress={() => { setDraft(null); setMessage(''); }} />
          </> : <>
            <Text style={styles.label}>Traitement</Text>
            {item.status === 'open' && <PrimaryButton title="Prendre en charge" disabled={busy} onPress={() => void setStatus('in_progress')} />}
            {item.status !== 'resolved' && item.status !== 'closed' && <PrimaryButton title="Marquer comme résolue" outline disabled={busy} onPress={() => void setStatus('resolved')} />}
            {item.status !== 'closed' && <PrimaryButton title="Clore la demande" outline disabled={busy} onPress={() => void setStatus('closed')} />}
            <PrimaryButton title="Modifier la demande" outline disabled={busy} onPress={startEditing} />
            {confirmDelete ? <View style={styles.deleteConfirm}>
              <Text style={styles.deleteText}>Supprimer définitivement cette demande et sa capture d’écran ?</Text>
              <PrimaryButton title={busy ? 'Suppression…' : 'Confirmer la suppression'} disabled={busy} onPress={() => void deleteRequest()} />
              <PrimaryButton title="Annuler" outline disabled={busy} onPress={() => setConfirmDelete(false)} />
            </View> : <Pressable style={styles.deleteButton} disabled={busy} onPress={() => { setMessage(''); setConfirmDelete(true); }}>
              <Text style={styles.deleteText}>Supprimer la demande</Text>
            </Pressable>}
          </>}
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
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.pale },
  optionSelected: { backgroundColor: colors.blue },
  optionText: { color: colors.navy, fontSize: 13 },
  optionTextSelected: { color: colors.white, fontWeight: '700' },
  deleteButton: { padding: 14, borderWidth: 1, borderColor: colors.red ?? '#B42318', borderRadius: 12, alignItems: 'center' },
  deleteConfirm: { padding: 14, gap: 10, borderWidth: 1, borderColor: colors.red ?? '#B42318', borderRadius: 12 },
  deleteText: { color: colors.red ?? '#B42318', fontWeight: '700' },
});
