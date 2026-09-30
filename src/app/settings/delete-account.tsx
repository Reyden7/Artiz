import { useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { AppScreen, Field, PrimaryButton } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { clearPendingProfessionalRegistration } from '@/features/auth/professional-registration';
import { clearPushRegistrationAfterAccountDeletion } from '@/features/notifications/push';
import { supabase } from '@/services/supabase/client';

export default function DeleteAccountScreen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [deleted, setDeleted] = useState(false);

  async function removeAccount() {
    if (!supabase || !session || confirmation !== 'SUPPRIMER' || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke<{ deleted: boolean }>('delete-account', {
        body: { confirmation: 'SUPPRIMER' },
      });
      if (error || !data?.deleted) {
        if (error instanceof FunctionsHttpError) {
          const payload = await error.context.json().catch(() => null);
          if (payload && typeof payload.error === 'string') throw new Error(payload.error);
        }
        throw new Error('La suppression a échoué. Réessayez plus tard.');
      }
      setDeleted(true);
      await Promise.allSettled([
        clearPushRegistrationAfterAccountDeletion(),
        clearPendingProfessionalRegistration(),
      ]);
      queryClient.clear();
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) setMessage('Compte supprimé. Fermez puis rouvrez l’application pour terminer la déconnexion.');
      else router.replace('/login');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La suppression a échoué. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDeletion() {
    if (confirmation !== 'SUPPRIMER' || busy) return;
    const title = 'Supprimer définitivement mon compte ?';
    const detail = 'Votre profil, vos publications, vos messages, vos demandes et vos fichiers seront supprimés. Cette action est irréversible.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`${title}\n\n${detail}`)) void removeAccount();
      return;
    }
    Alert.alert(title, detail, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer définitivement', style: 'destructive', onPress: () => void removeAccount() },
    ]);
  }

  return <AppScreen title="Supprimer mon compte">
    <View style={styles.card}>
      {deleted ? <>
        <Text style={styles.title}>Compte supprimé</Text>
        <Text style={styles.description}>Votre compte Artiz a été supprimé.</Text>
        {message ? <Text style={styles.error}>{message}</Text> : null}
        <PrimaryButton title="Se connecter" onPress={() => router.replace('/login')} outline />
      </> : <>
        <Text style={styles.title}>Une décision définitive</Text>
        <Text style={styles.description}>La suppression efface votre compte, votre profil, vos publications, vos demandes, vos avis, vos messages et vos fichiers. Les autres membres ne pourront plus vous retrouver. Cette action ne peut pas être annulée.</Text>
        <Text style={styles.description}>Compte concerné : {session?.user.email ?? 'votre compte connecté'}</Text>
        <Field label="Pour confirmer, saisissez SUPPRIMER" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} maxLength={9} accessibilityLabel="Saisir SUPPRIMER pour confirmer la suppression du compte" />
        {message ? <Text style={styles.error} accessibilityRole="alert">{message}</Text> : null}
        <PrimaryButton title={busy ? 'Suppression en cours…' : 'Supprimer mon compte'} onPress={confirmDeletion} disabled={busy || confirmation !== 'SUPPRIMER'} />
        <PrimaryButton title="Conserver mon compte" outline onPress={() => router.back()} disabled={busy} />
      </>}
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 20, gap: 14 },
  title: { color: colors.navy, fontSize: 20, fontWeight: '700' },
  description: { color: colors.muted, lineHeight: 22 },
  error: { color: '#A52929', lineHeight: 21 },
});
