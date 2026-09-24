import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { MainScreen, Avatar, PrimaryButton, SectionTitle } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/services/supabase/client';

export default function ProfileScreen() {
  const { session } = useAuth();
  return <MainScreen title="Mon profil">
    <View style={styles.card}><Avatar name={session?.user.user_metadata?.display_name ?? 'Artiz'} size={76} /><Text style={styles.title}>{session?.user.user_metadata?.display_name ?? 'Mon compte'}</Text><Text style={styles.meta}>{session?.user.email}</Text><PrimaryButton title="Se déconnecter" onPress={() => supabase?.auth.signOut()} outline /></View>
    <SectionTitle title="À découvrir" />
    <Pressable style={styles.row} onPress={() => router.push('/explore')}><Text style={styles.rowText}>Explorer les artisans</Text><Text style={styles.arrow}>›</Text></Pressable>
  </MainScreen>;
}

const styles = StyleSheet.create({ card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 20, alignItems: 'center', gap: 12 }, title: { fontSize: 20, fontWeight: '700', color: colors.navy }, meta: { color: colors.muted, lineHeight: 22, textAlign: 'center', marginBottom: 4 }, row: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 16, minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowText: { color: colors.navy, fontWeight: '600' }, arrow: { color: colors.blue, fontSize: 22 } });
