import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen, Avatar, PrimaryButton, SectionTitle } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/services/supabase/client';

export default function ProfileScreen() {
  const { session } = useAuth();
  return <AppScreen title="Mon profil">
    <View style={styles.card}><Avatar name={session?.user.user_metadata?.display_name ?? 'Artiz'} size={76} /><Text style={styles.title}>{session ? (session.user.user_metadata?.display_name ?? 'Mon compte') : 'Bienvenue sur Artiz'}</Text><Text style={styles.meta}>{session ? session.user.email : 'Connectez-vous pour retrouver vos favoris, vos messages et votre réseau.'}</Text>{session ? <PrimaryButton title="Se déconnecter" onPress={() => supabase?.auth.signOut()} outline /> : <><PrimaryButton title="Se connecter" onPress={() => router.push('/login')} /><PrimaryButton title="Créer un compte" onPress={() => router.push('/register')} outline /></>}</View>
    <SectionTitle title="À découvrir" />
    <Pressable style={styles.row} onPress={() => router.push('/professional/thomas-moreau')}><Text style={styles.rowText}>Le profil de Thomas Moreau</Text><Text style={styles.arrow}>›</Text></Pressable>
    <Pressable style={styles.row} onPress={() => router.push('/explore')}><Text style={styles.rowText}>Explorer les artisans</Text><Text style={styles.arrow}>›</Text></Pressable>
  </AppScreen>;
}

const styles = StyleSheet.create({ card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 22, alignItems: 'center', gap: 13 }, title: { fontSize: 23, fontWeight: '800', color: colors.navy }, meta: { color: colors.muted, lineHeight: 21, textAlign: 'center', marginBottom: 5 }, row: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 17, flexDirection: 'row', justifyContent: 'space-between' }, rowText: { color: colors.navy, fontWeight: '700' }, arrow: { color: colors.blue, fontSize: 22 } });
