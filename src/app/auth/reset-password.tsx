import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { AuthScreen, Brand, Field, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { readAuthLinkParameters } from '@/features/auth/callback-parameters';
import { passwordValidationMessage } from '@/features/auth/password-policy';
import { openRecoverySession, recoveryErrorMessage } from '@/features/auth/password-recovery';
import { revokePushForCurrentDevice } from '@/features/notifications/push';
import { supabase } from '@/services/supabase/client';

type ScreenState = 'loading' | 'form' | 'success' | 'error';

export default function ResetPasswordScreen() {
  const linkedUrl = Linking.useLinkingURL();
  const routeParams = useLocalSearchParams();
  const [initialUrl, setInitialUrl] = useState<string | null | undefined>();
  const [linkWaitFinished, setLinkWaitFinished] = useState(false);
  const [state, setState] = useState<ScreenState>('loading');
  const [message, setMessage] = useState('Vérification du lien de réinitialisation…');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const attempt = readAuthLinkParameters([linkedUrl, initialUrl], routeParams, 'auth/reset-password').toString();
  const isResetUrl = (url: string | null | undefined) => Boolean(url?.split(/[?#]/, 1)[0].endsWith('auth/reset-password'));
  const ready = Boolean(attempt) || isResetUrl(linkedUrl) || isResetUrl(initialUrl) || linkWaitFinished;

  useEffect(() => {
    let active = true;
    const fallback = setTimeout(() => {
      if (active) { setInitialUrl((current) => current === undefined ? null : current); setLinkWaitFinished(true); }
    }, 3000);
    void Linking.getInitialURL().then((url) => {
      if (active) setInitialUrl(url);
    }).catch(() => {
      if (active) setInitialUrl(null);
    });
    return () => { active = false; clearTimeout(fallback); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    async function verifyLink() {
      setState('loading');
      try {
        await openRecoverySession(new URLSearchParams(attempt));
        if (active) { setMessage(''); setState('form'); }
      } catch (error) {
        if (active) { setMessage(recoveryErrorMessage(error)); setState('error'); }
      }
    }
    void verifyLink();
    return () => { active = false; };
  }, [ready, attempt]);

  async function updatePassword() {
    const validation = passwordValidationMessage(password, confirmation);
    if (validation) { setMessage(validation); return; }
    if (!supabase) { setMessage('Service momentanément indisponible. Réessayez plus tard.'); return; }
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setMessage(recoveryErrorMessage(error)); return; }
      setPassword('');
      setConfirmation('');
      setMessage('Votre mot de passe a été modifié.');
      setState('success');
      // A recovery link grants a temporary session; close it on this device.
      try { await revokePushForCurrentDevice(); await supabase.auth.signOut({ scope: 'local' }); }
      catch { /* The button retries sign-out. */ }
    } catch (error) {
      setMessage(recoveryErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function goToLogin() {
    if (supabase) {
      try {
        await revokePushForCurrentDevice();
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) { setMessage('La déconnexion a échoué. Réessayez pour revenir à la connexion.'); return; }
      } catch { setMessage('Connexion indisponible. Réessayez pour revenir à la connexion.'); return; }
    }
    router.replace('/login');
  }

  return <AuthScreen>
    <View style={styles.center}>
      <Brand />
      <Text style={styles.title}>{state === 'success' ? 'Mot de passe modifié' : 'Réinitialiser le mot de passe'}</Text>
      {state === 'loading' && <ActivityIndicator color={colors.blue} />}
      {state === 'form' && <Text style={styles.subtitle}>Choisissez un nouveau mot de passe pour votre compte Artiz.</Text>}
    </View>
    {state === 'form' && <>
      <Field label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="Au moins 8 caractères" />
      <Field label="Confirmer le nouveau mot de passe" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" placeholder="Confirmez le mot de passe" />
      <Text style={styles.hint}>Au moins 8 caractères, une lettre et un chiffre.</Text>
    </>}
    {message ? <Text style={[styles.message, state === 'success' && styles.success]}>{message}</Text> : null}
    {state === 'form' && <PrimaryButton title={busy ? 'Modification…' : 'Modifier mon mot de passe'} onPress={updatePassword} disabled={busy} />}
    {state === 'error' && <PrimaryButton title="Demander un nouveau lien" onPress={() => router.replace('/forgot-password')} />}
    {(state === 'success' || state === 'error') && <PrimaryButton title="Se connecter" onPress={() => void goToLogin()} outline />}
  </AuthScreen>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 12, paddingBottom: 8 },
  title: { color: colors.navy, fontSize: 26, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 13 },
  message: { color: colors.red, backgroundColor: colors.pale, padding: 12, borderRadius: 8, textAlign: 'center' },
  success: { color: colors.navy },
});
