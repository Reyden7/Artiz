import { useState } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { AuthScreen, Brand, Field, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { supabase } from '@/services/supabase/client';

const genericMessage = 'Si un compte existe pour cette adresse, un e-mail de réinitialisation a été envoyé.';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');

  async function sendLink() {
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setMessage('Saisissez une adresse e-mail valide.');
      return;
    }
    if (!supabase) {
      setMessage('Service momentanément indisponible. Réessayez plus tard.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: Linking.createURL('auth/reset-password'),
      });
      if (error) {
        if (/network|fetch/i.test(error.message)) {
          setMessage('Connexion indisponible. Vérifiez votre accès à Internet puis réessayez.');
          return;
        }
        // Account-specific throttling and unknown-user errors must look identical to success.
      }
      setSent(true);
      setMessage(genericMessage);
    } catch {
      setMessage('Connexion indisponible. Vérifiez votre accès à Internet puis réessayez.');
    } finally {
      setBusy(false);
    }
  }

  return <AuthScreen>
    <View style={styles.center}><Brand /><Text style={styles.title}>Mot de passe oublié ?</Text><Text style={styles.subtitle}>Indiquez votre adresse e-mail pour recevoir un lien de réinitialisation.</Text></View>
    {!sent && <Field label="Adresse e-mail" value={email} onChangeText={setEmail} placeholder="Votre adresse e-mail" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />}
    {message ? <Text style={[styles.message, sent && styles.success]}>{message}</Text> : null}
    {!sent && <PrimaryButton title={busy ? 'Envoi…' : 'Envoyer le lien de réinitialisation'} onPress={sendLink} disabled={busy} />}
    <PrimaryButton title="Se connecter" onPress={() => router.replace('/login')} outline />
  </AuthScreen>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 8, paddingBottom: 8 },
  title: { color: colors.navy, fontSize: 26, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  message: { color: colors.red, backgroundColor: colors.pale, padding: 12, borderRadius: 8 },
  success: { color: colors.navy },
});
