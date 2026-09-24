import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthScreen, Brand, Field, PrimaryButton } from '@/components/artiz-ui';
import { AccountType, colors } from '@/constants/artiz';
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
    if (type === 'professional') { setMessage('La vérification du SIRET côté serveur est nécessaire avant l’ouverture des comptes professionnels. Ce parcours sera activé avec le backend sécurisé.'); return; }
    if (!supabase) { setMessage('Ajoutez les variables Supabase dans .env pour activer l’inscription.'); return; }
    setBusy(true); setMessage('');
    const { error, data } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } });
    setBusy(false);
    if (error) setMessage(error.message);
    else if (!data.session) setMessage('Vérifiez votre boîte e-mail pour confirmer votre inscription.');
    else router.replace('/profile');
  }
  return <AuthScreen>
    <View style={styles.center}><Brand /><Text style={styles.title}>Créer un compte</Text><Text style={styles.subtitle}>Rejoignez le réseau des talents locaux.</Text></View>
    <View style={styles.switch}><Pressable style={[styles.choice, type === 'customer' && styles.selected]} onPress={() => { setType('customer'); setMessage(''); }}><Ionicons name="person-outline" size={20} color={type === 'customer' ? colors.white : colors.navy} /><Text style={[styles.choiceText, type === 'customer' && styles.selectedText]}>Particulier</Text></Pressable><Pressable style={[styles.choice, type === 'professional' && styles.selected]} onPress={() => { setType('professional'); setMessage(''); }}><Ionicons name="briefcase-outline" size={20} color={type === 'professional' ? colors.white : colors.navy} /><Text style={[styles.choiceText, type === 'professional' && styles.selectedText]}>Professionnel</Text></Pressable></View>
    <Text style={styles.roleHelp}>{type === 'customer' ? 'Pour découvrir des réalisations, suivre des artisans et publier un besoin.' : 'Pour présenter votre activité et vos réalisations. SIRET obligatoire.'}</Text>
    <Field label="Nom complet" value={name} onChangeText={setName} placeholder="Ex. Camille Martin" autoComplete="name" />
    <Field label="Adresse e-mail" value={email} onChangeText={setEmail} placeholder="exemple@monadresse.fr" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
    <Field label="Mot de passe" value={password} onChangeText={setPassword} placeholder="8 caractères, une lettre et un chiffre" secureTextEntry autoComplete="new-password" />
    <Field label="Confirmer le mot de passe" value={confirm} onChangeText={setConfirm} placeholder="Confirmez votre mot de passe" secureTextEntry />
    {type === 'professional' && <><Field label="Nom commercial" value={business} onChangeText={setBusiness} placeholder="Ex. Atelier Moreau" /><Field label="Numéro de SIRET" value={siret} onChangeText={setSiret} placeholder="14 chiffres" keyboardType="number-pad" maxLength={14} /><Text style={styles.roleHelp}>Le SIRET sera contrôlé par un service sécurisé avant toute activation professionnelle.</Text></>}
    <Pressable style={styles.consent} onPress={() => setAccepted(!accepted)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}><Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={23} color={colors.blue} /><Text style={styles.consentText}>J’accepte les conditions d’utilisation et la politique de confidentialité.</Text></Pressable>
    {message ? <Text style={styles.message}>{message}</Text> : null}
    <PrimaryButton title={busy ? 'Création…' : 'Créer mon compte'} icon="arrow-forward" onPress={signUp} disabled={busy || !name.trim() || !email.trim() || !password || !confirm || (type === 'professional' && (!business.trim() || siret.length !== 14))} />
    <Text style={styles.bottom}>Déjà un compte ? <Text style={styles.link} onPress={() => router.push('/login')}>Se connecter</Text></Text>
  </AuthScreen>;
}

const styles = StyleSheet.create({ center: { alignItems: 'center', gap: 7, paddingVertical: 15 }, title: { fontSize: 27, color: colors.navy, fontWeight: '800', marginTop: 10 }, subtitle: { color: colors.muted, fontSize: 15, textAlign: 'center' }, switch: { flexDirection: 'row', backgroundColor: colors.pale, borderRadius: 14, padding: 4 }, choice: { flex: 1, height: 52, borderRadius: 11, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, selected: { backgroundColor: colors.blue }, choiceText: { color: colors.navy, fontWeight: '700' }, selectedText: { color: colors.white }, roleHelp: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' }, consent: { flexDirection: 'row', alignItems: 'center', gap: 10 }, consentText: { color: colors.navy, flex: 1, fontSize: 13, lineHeight: 18 }, message: { backgroundColor: colors.pale, color: colors.blueDark, padding: 12, borderRadius: 10, lineHeight: 19 }, bottom: { textAlign: 'center', color: colors.navy }, link: { color: colors.blue, fontWeight: '800' } });
