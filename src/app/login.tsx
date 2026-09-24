import { useState } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthScreen, Brand, Field, PrimaryButton } from '@/components/artiz-ui';
import { colors, photos } from '@/constants/artiz';
import { supabase } from '@/services/supabase/client';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function signIn() {
    if (!supabase) { setMessage('Ajoutez les variables Supabase dans .env pour activer la connexion.'); return; }
    setBusy(true); setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMessage(error.message); else router.replace('/profile');
  }
  return <AuthScreen>
    <Image source={photos.bookshelf} style={styles.hero} />
    <View style={styles.center}><Brand /><Text style={styles.title}>Bienvenue sur Artiz</Text><Text style={styles.subtitle}>Découvrez des artisans, partagez vos réalisations et échangez facilement.</Text></View>
    <Field label="Adresse e-mail" value={email} onChangeText={setEmail} placeholder="exemple@monadresse.fr" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
    <Field label="Mot de passe" value={password} onChangeText={setPassword} placeholder="Votre mot de passe" secureTextEntry autoComplete="current-password" />
    {message ? <Text style={styles.message}>{message}</Text> : null}
    <PrimaryButton title={busy ? 'Connexion…' : 'Se connecter'} onPress={signIn} disabled={busy || !email.trim() || !password} />
    <Text style={styles.bottom}>Pas encore de compte ? <Text style={styles.link} onPress={() => router.push('/register')}>S’inscrire</Text></Text>
    <Pressable onPress={() => router.replace('/')}><Text style={styles.skip}>Découvrir Artiz sans compte</Text></Pressable>
  </AuthScreen>;
}

const styles = StyleSheet.create({ hero: { height: 170, width: '100%', borderRadius: 20 }, center: { alignItems: 'center', gap: 7, paddingBottom: 6 }, title: { color: colors.navy, fontSize: 27, fontWeight: '800', textAlign: 'center', marginTop: 12 }, subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' }, message: { color: colors.blueDark, backgroundColor: colors.pale, padding: 12, borderRadius: 10 }, bottom: { color: colors.navy, textAlign: 'center' }, link: { color: colors.blue, fontWeight: '800' }, skip: { color: colors.muted, textAlign: 'center', fontSize: 13 } });
