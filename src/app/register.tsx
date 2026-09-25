import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { AuthScreen, Brand, Field, PrimaryButton } from '@/components/artiz-ui';
import { AccountType, colors } from '@/constants/artiz';
import { completeProfessionalRegistration, savePendingProfessionalRegistration } from '@/features/auth/professional-registration';
import { supabase } from '@/services/supabase/client';

export default function RegisterScreen() {
  const [type, setType] = useState<AccountType>('customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [business, setBusiness] = useState('');
  const [siret, setSiret] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function signUp() {
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) { setMessage('Le mot de passe doit contenir 8 caractères, une lettre et un chiffre.'); return; }
    if (password !== confirm) { setMessage('Les mots de passe ne correspondent pas.'); return; }
    if (!accepted) { setMessage('Acceptez les conditions pour continuer.'); return; }
    if (type === 'professional' && (!/^\d{14}$/.test(siret) || business.trim().length < 2)) {
      setMessage('Renseignez un nom commercial et un SIRET de 14 chiffres.'); return;
    }
    if (!supabase) { setMessage('Ajoutez les variables Supabase dans .env pour activer l’inscription.'); return; }
    setBusy(true); setMessage('');
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error, data } = await supabase.auth.signUp({
        email: normalizedEmail, password, options: {
          data: { display_name: name.trim() },
          emailRedirectTo: Linking.createURL('auth/callback'),
        },
      });
      if (error) { setMessage(error.message); return; }
      if (type === 'professional') {
        const pending = { email: normalizedEmail, businessName: business.trim(), siret };
        await savePendingProfessionalRegistration(pending);
        if (data.session) await completeProfessionalRegistration(pending);
      }
      if (!data.session) {
        setMessage(type === 'professional'
          ? 'Confirmez votre e-mail puis connectez-vous. Votre demande professionnelle sera vérifiée après connexion.'
          : 'Vérifiez votre boîte e-mail pour confirmer votre inscription.');
      } else router.replace('/profile');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Inscription temporairement indisponible.');
    } finally {
      setBusy(false);
    }
  }
  return <AuthScreen>
    <View style={styles.center}><Brand /><Text style={styles.title}>Créer un compte</Text><Text style={styles.subtitle}>Rejoignez le réseau des talents locaux.</Text></View>
    <View style={styles.switch}><Pressable style={[styles.choice, type === 'customer' && styles.selected]} onPress={() => { setType('customer'); setMessage(''); }}><Ionicons name="person-outline" size={20} color={type === 'customer' ? colors.white : colors.navy} /><Text style={[styles.choiceText, type === 'customer' && styles.selectedText]}>Particulier</Text></Pressable><Pressable style={[styles.choice, type === 'professional' && styles.selected]} onPress={() => { setType('professional'); setMessage(''); }}><Ionicons name="briefcase-outline" size={20} color={type === 'professional' ? colors.white : colors.navy} /><Text style={[styles.choiceText, type === 'professional' && styles.selectedText]}>Professionnel</Text></Pressable></View>
    <Text style={styles.roleHelp}>{type === 'customer' ? 'Pour découvrir des réalisations, suivre des artisans et publier un besoin.' : 'Pour présenter votre activité et vos réalisations. SIRET obligatoire.'}</Text>
    <Field label="Nom complet" value={name} onChangeText={setName} placeholder="Votre nom complet" autoComplete="name" />
    <Field label="Adresse e-mail" value={email} onChangeText={setEmail} placeholder="Votre adresse e-mail" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
    <Field label="Mot de passe" value={password} onChangeText={setPassword} placeholder="8 caractères, une lettre et un chiffre" secureTextEntry autoComplete="new-password" />
    <Field label="Confirmer le mot de passe" value={confirm} onChangeText={setConfirm} placeholder="Confirmez votre mot de passe" secureTextEntry />
    {type === 'professional' && <><Field label="Nom commercial" value={business} onChangeText={setBusiness} placeholder="Nom de votre entreprise" /><Field label="Numéro de SIRET" value={siret} onChangeText={setSiret} placeholder="14 chiffres" keyboardType="number-pad" maxLength={14} /><Text style={styles.roleHelp}>Le SIRET est contrôlé côté serveur. Le profil reste en attente de vérification avant de pouvoir publier ou répondre aux demandes.</Text></>}
    <Pressable style={styles.consent} onPress={() => setAccepted(!accepted)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}><Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={23} color={colors.blue} /><Text style={styles.consentText}>J’accepte les conditions d’utilisation et la politique de confidentialité.</Text></Pressable>
    {message ? <Text style={styles.message}>{message}</Text> : null}
    <PrimaryButton title={busy ? 'Création…' : 'Créer mon compte'} icon="arrow-forward" onPress={signUp} disabled={busy || !name.trim() || !email.trim() || !password || !confirm || (type === 'professional' && (!business.trim() || siret.length !== 14))} />
    <Text style={styles.bottom}>Déjà un compte ? <Text style={styles.link} onPress={() => router.push('/login')}>Se connecter</Text></Text>
  </AuthScreen>;
}

const styles = StyleSheet.create({ center: { alignItems: 'center', gap: 8, paddingVertical: 16 }, title: { fontSize: 26, color: colors.navy, fontWeight: '700', marginTop: 12 }, subtitle: { color: colors.muted, fontSize: 15, textAlign: 'center' }, switch: { flexDirection: 'row', backgroundColor: colors.pale, borderRadius: 12, padding: 4 }, choice: { flex: 1, minHeight: 48, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, selected: { backgroundColor: colors.blue }, choiceText: { color: colors.navy, fontWeight: '600' }, selectedText: { color: colors.white }, roleHelp: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' }, consent: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }, consentText: { color: colors.navy, flex: 1, fontSize: 14, lineHeight: 20 }, message: { backgroundColor: colors.pale, color: colors.blueDark, padding: 12, borderRadius: 8, lineHeight: 20 }, bottom: { textAlign: 'center', color: colors.navy }, link: { color: colors.blue, fontWeight: '700' } });
