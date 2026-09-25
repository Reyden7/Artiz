import { useCallback, useState } from 'react';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { MainScreen, Avatar, Field, PrimaryButton, SectionTitle } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { completeProfessionalRegistration, getPendingProfessionalRegistration, savePendingProfessionalRegistration, type PendingProfessionalRegistration } from '@/features/auth/professional-registration';
import { registerPushForCurrentDevice, resumePushRegistration, revokePushForCurrentDevice } from '@/features/notifications/push';
import { supabase } from '@/services/supabase/client';

export default function ProfileScreen() {
  const { session } = useAuth();
  const [pending, setPending] = useState<PendingProfessionalRegistration | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyCategory, setBusyCategory] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [message, setMessage] = useState('');
  const userId = session?.user.id;
  const email = session?.user.email;
  const queryClient = useQueryClient();
  const notificationPreferences = useQuery({
    queryKey: ['notification-preferences', userId],
    enabled: Boolean(supabase && userId),
    queryFn: async () => {
      if (!supabase || !userId) return null;
      const { data, error } = await supabase.from('notification_preferences')
        .select('new_messages,request_responses,admin_professionals,admin_support').eq('user_id', userId).single();
      if (error) throw error;
      return data;
    },
  });
  const professionalCategories = useQuery({
    queryKey: ['my-professional-categories', userId],
    enabled: Boolean(supabase && userId && verificationStatus === 'verified'),
    queryFn: async () => {
      if (!supabase || !userId) return { categories: [], selected: [] as string[] };
      const [categories, links] = await Promise.all([
        supabase.from('professional_categories').select('id,name').order('name'),
        supabase.from('professional_category_links').select('category_id').eq('professional_id', userId),
      ]);
      if (categories.error) throw categories.error;
      if (links.error) throw links.error;
      return { categories: categories.data, selected: links.data.map((link) => link.category_id) };
    },
  });
  useFocusEffect(useCallback(() => {
    if (!email || !userId || !supabase) return;
    let active = true;
    getPendingProfessionalRegistration(email)
      .then((value) => { if (active) setPending(value); });
    supabase.from('professional_profiles').select('verification_status')
      .eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (active) setVerificationStatus(data?.verification_status ?? null); });
    supabase.functions.invoke('review-professionals', { method: 'GET' })
      .then(({ error }) => { if (active) setIsAdmin(!error); });
    return () => { active = false; };
  }, [email, userId]));

  async function retryProfessionalRegistration() {
    if (!pending) return;
    setBusy(true); setMessage('');
    try {
      await savePendingProfessionalRegistration(pending);
      await completeProfessionalRegistration(pending);
      setPending(null);
      setVerificationStatus('pending');
      setMessage('Votre entreprise a bien été identifiée. Votre compte professionnel est en attente de validation.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La vérification du SIRET a échoué.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleCategory(categoryId: string) {
    if (!supabase || !userId || busyCategory) return;
    setBusyCategory(categoryId);
    const selected = professionalCategories.data?.selected.includes(categoryId);
    const result = selected
      ? await supabase.from('professional_category_links').delete()
        .eq('professional_id', userId).eq('category_id', categoryId)
      : await supabase.from('professional_category_links')
        .insert({ professional_id: userId, category_id: categoryId });
    if (result.error) setMessage('Impossible de mettre à jour ce métier.');
    else {
      setMessage('');
      await queryClient.invalidateQueries({ queryKey: ['my-professional-categories', userId] });
    }
    setBusyCategory(null);
  }

  async function enablePush() {
    if (pushBusy || !supabase || !userId) return;
    setPushBusy(true); setMessage('');
    try {
      const { data: admin, error } = await supabase.rpc('is_artiz_admin_self');
      if (error) throw error;
      resumePushRegistration();
      await registerPushForCurrentDevice({ userId, adminOnly: admin === true, requestPermission: true });
      setMessage('Notifications activées sur cet appareil.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Activation impossible.');
    } finally { setPushBusy(false); }
  }

  async function toggleNotificationPreference(key: 'new_messages' | 'request_responses' | 'admin_professionals' | 'admin_support') {
    if (!supabase || !userId || !notificationPreferences.data) return;
    const current = notificationPreferences.data;
    const update = key === 'new_messages' ? { new_messages: !current.new_messages }
      : key === 'request_responses' ? { request_responses: !current.request_responses }
        : key === 'admin_professionals' ? { admin_professionals: !current.admin_professionals }
          : { admin_support: !current.admin_support };
    const { error } = await supabase.from('notification_preferences')
      .update(update).eq('user_id', userId);
    if (error) setMessage('Impossible de modifier cette préférence.');
    else await queryClient.invalidateQueries({ queryKey: ['notification-preferences', userId] });
  }

  async function signOut() {
    if (!supabase) return;
    try { await revokePushForCurrentDevice(); }
    catch { resumePushRegistration(); setMessage('Impossible de retirer cet appareil des notifications. Réessayez avant de vous déconnecter.'); return; }
    const { error } = await supabase.auth.signOut();
    if (error) { resumePushRegistration(); setMessage('La déconnexion a échoué. Réessayez.'); }
  }

  return <MainScreen title="Mon profil">
    <View style={styles.card}><Avatar name={session?.user.user_metadata?.display_name ?? 'Artiz'} size={76} /><Text style={styles.title}>{session?.user.user_metadata?.display_name ?? 'Mon compte'}</Text><Text style={styles.meta}>{session?.user.email}</Text><PrimaryButton title="Se déconnecter" onPress={() => void signOut()} outline /></View>
    <View style={styles.categoryCard}>
      <Text style={styles.title}>Notifications</Text>
      <PrimaryButton title={pushBusy ? 'Activation…' : 'Activer sur cet appareil'} onPress={() => void enablePush()} disabled={pushBusy} outline />
      {notificationPreferences.data && <>
        <Pressable style={styles.preference} onPress={() => void toggleNotificationPreference('new_messages')} accessibilityRole="switch" accessibilityState={{ checked: notificationPreferences.data.new_messages }}><Text style={styles.rowText}>Nouveaux messages</Text><Text style={styles.preferenceState}>{notificationPreferences.data.new_messages ? 'Activé' : 'Désactivé'}</Text></Pressable>
        <Pressable style={styles.preference} onPress={() => void toggleNotificationPreference('request_responses')} accessibilityRole="switch" accessibilityState={{ checked: notificationPreferences.data.request_responses }}><Text style={styles.rowText}>Réponses à mes besoins</Text><Text style={styles.preferenceState}>{notificationPreferences.data.request_responses ? 'Activé' : 'Désactivé'}</Text></Pressable>
        {isAdmin && <Pressable style={styles.preference} onPress={() => void toggleNotificationPreference('admin_professionals')} accessibilityRole="switch" accessibilityState={{ checked: notificationPreferences.data.admin_professionals }}><Text style={styles.rowText}>Professionnels à valider</Text><Text style={styles.preferenceState}>{notificationPreferences.data.admin_professionals ? 'Activé' : 'Désactivé'}</Text></Pressable>}
        {isAdmin && <Pressable style={styles.preference} onPress={() => void toggleNotificationPreference('admin_support')} accessibilityRole="switch" accessibilityState={{ checked: notificationPreferences.data.admin_support }}><Text style={styles.rowText}>Demandes de support</Text><Text style={styles.preferenceState}>{notificationPreferences.data.admin_support ? 'Activé' : 'Désactivé'}</Text></Pressable>}
      </>}
      {message ? <Text style={styles.meta}>{message}</Text> : null}
    </View>
    {verificationStatus && <View style={styles.card}><Text style={styles.title}>Compte professionnel</Text><Text style={styles.meta}>{verificationStatus === 'pending' ? 'Votre entreprise a bien été identifiée. Votre compte professionnel est en attente de validation.' : verificationStatus === 'verified' ? 'Votre activité est vérifiée.' : 'Vérification : ' + verificationStatus}</Text></View>}
    {pending && <View style={styles.card}><Text style={styles.title}>Terminer l’inscription professionnelle</Text><Text style={styles.meta}>Votre compte est créé. Confirmez votre SIRET pour soumettre votre activité à vérification.</Text><Field label="Nom commercial" value={pending.businessName} onChangeText={(businessName) => setPending({ ...pending, businessName })} /><Field label="SIRET" value={pending.siret} onChangeText={(siret) => setPending({ ...pending, siret })} keyboardType="number-pad" maxLength={14} /><PrimaryButton title={busy ? 'Vérification…' : 'Vérifier mon SIRET'} onPress={retryProfessionalRegistration} disabled={busy || pending.businessName.trim().length < 2 || !/^\d{14}$/.test(pending.siret)} />{message ? <Text style={styles.meta}>{message}</Text> : null}</View>}
    {isAdmin && <Pressable style={styles.row} onPress={() => router.push('/admin/professionals')}><Text style={styles.rowText}>Professionnels en attente</Text><Text style={styles.arrow}>›</Text></Pressable>}
    {isAdmin && <Pressable style={styles.row} onPress={() => router.push('/admin/support' as Href)}><Text style={styles.rowText}>Demandes de support</Text><Text style={styles.arrow}>›</Text></Pressable>}
    {verificationStatus === 'verified' && <View style={styles.categoryCard}>
      <Text style={styles.title}>Mes métiers</Text>
      <Text style={styles.meta}>Choisissez les catégories des demandes que vous souhaitez consulter.</Text>
      <View style={styles.categories}>{professionalCategories.data?.categories.map((category) => {
        const selected = professionalCategories.data.selected.includes(category.id);
        return <Pressable key={category.id} onPress={() => void toggleCategory(category.id)} disabled={Boolean(busyCategory)} style={[styles.category, selected && styles.categoryActive]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}><Text style={[styles.categoryText, selected && styles.categoryTextActive]}>{category.name}</Text></Pressable>;
      })}</View>
      {message ? <Text style={styles.meta}>{message}</Text> : null}
    </View>}
    {(verificationStatus === null || verificationStatus === 'verified') && <Pressable style={styles.row} onPress={() => router.push('/requests')}><Text style={styles.rowText}>{verificationStatus === 'verified' ? 'Besoins près de chez moi' : 'Mes besoins'}</Text><Text style={styles.arrow}>›</Text></Pressable>}
    <Pressable style={styles.row} onPress={() => router.push('/settings' as Href)}><Text style={styles.rowText}>Paramètres</Text><Text style={styles.arrow}>›</Text></Pressable>
    <SectionTitle title="À découvrir" />
    <Pressable style={styles.row} onPress={() => router.push('/explore')}><Text style={styles.rowText}>Explorer les artisans</Text><Text style={styles.arrow}>›</Text></Pressable>
  </MainScreen>;
}

const styles = StyleSheet.create({ card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 20, alignItems: 'center', gap: 12 }, title: { fontSize: 20, fontWeight: '700', color: colors.navy }, meta: { color: colors.muted, lineHeight: 22, textAlign: 'center', marginBottom: 4 }, row: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 16, minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowText: { color: colors.navy, fontWeight: '600' }, arrow: { color: colors.blue, fontSize: 22 }, categoryCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 20, gap: 12 }, categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, category: { backgroundColor: colors.pale, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10 }, categoryActive: { backgroundColor: colors.blue }, categoryText: { color: colors.navy, fontSize: 13 }, categoryTextActive: { color: colors.white, fontWeight: '700' }, preference: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, preferenceState: { color: colors.blue, fontWeight: '600' } });
