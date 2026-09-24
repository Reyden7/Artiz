import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { router } from 'expo-router';
import { EmptyState, MainScreen } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';

export default function HomeScreen() {
  const [tab, setTab] = useState<'feed' | 'nearby' | 'contacts'>('feed');
  return <MainScreen>
    <View style={styles.welcome}><Text style={styles.eyebrow}>LE SAVOIR-FAIRE PRÈS DE VOUS</Text><Text style={styles.title}>Bonjour 👋</Text><Text style={styles.text}>Découvrez les talents qui font vivre votre région.</Text></View>
    <View style={styles.tabs}>{([['feed', 'Fil d’actualité'], ['nearby', 'Autour de moi'], ['contacts', 'Mes contacts']] as const).map(([key, label]) => <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}><Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text></Pressable>)}</View>
    {tab === 'feed' ? <EmptyState icon="images-outline" title="Aucune publication pour le moment" description="Les réalisations partagées sur Artiz apparaîtront ici." action="Découvrir les artisans" onPress={() => router.replace('/explore')} /> : tab === 'nearby' ? <EmptyState icon="location-outline" title="Rien à proximité pour le moment" description="Les publications proches de vous apparaîtront ici." action="Explorer les métiers" onPress={() => router.replace('/explore')} /> : <EmptyState icon="people-outline" title="Aucune publication de vos contacts" description="Suivez des professionnels pour retrouver leurs réalisations dans cet onglet." action="Découvrir les artisans" onPress={() => router.replace('/explore')} />}
  </MainScreen>;
}

const styles = StyleSheet.create({
  welcome: { backgroundColor: colors.backgroundWarm, padding: 20, borderRadius: 20, gap: 4 },
  eyebrow: { fontSize: 12, letterSpacing: 1, color: colors.blue, fontWeight: '700' },
  title: { fontSize: 26, color: colors.navy, fontWeight: '700' },
  text: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  tabs: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 4, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, minHeight: 48, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent', alignItems: 'center' },
  tabActive: { borderBottomColor: colors.orange },
  tabText: { color: colors.muted, fontSize: 14 },
  tabTextActive: { color: colors.orange, fontWeight: '700' },
});
