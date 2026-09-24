import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen } from '@/components/artiz-ui';
import { PostCard } from '@/components/post-card';
import { colors } from '@/constants/artiz';
import { demoPosts } from '@/features/demo/data';

export default function HomeScreen() {
  const [tab, setTab] = useState<'feed' | 'nearby' | 'contacts'>('feed');
  return <AppScreen>
    <View style={styles.welcome}><Text style={styles.eyebrow}>LE SAVOIR-FAIRE PRÈS DE VOUS</Text><Text style={styles.title}>Bonjour 👋</Text><Text style={styles.text}>Découvrez les talents qui font vivre votre région.</Text></View>
    <View style={styles.tabs}>{([['feed', 'Fil d’actualité'], ['nearby', 'Autour de moi'], ['contacts', 'Mes contacts']] as const).map(([key, label]) => <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}><Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text></Pressable>)}</View>
    {tab === 'feed' ? demoPosts.map((post) => <PostCard key={post.id} post={post} />) : <View style={styles.empty}><Text style={styles.emptyTitle}>{tab === 'nearby' ? 'Explorez près de chez vous' : 'Votre réseau prend forme'}</Text><Text style={styles.text}>{tab === 'nearby' ? 'Choisissez un métier ou une ville pour découvrir des réalisations locales.' : 'Suivez des artisans pour retrouver leurs nouvelles réalisations ici.'}</Text><Pressable onPress={() => router.push(tab === 'nearby' ? '/explore' : '/network')}><Text style={styles.link}>Découvrir des professionnels ›</Text></Pressable></View>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  welcome: { backgroundColor: colors.pale, padding: 18, borderRadius: 18, gap: 3 },
  eyebrow: { fontSize: 10, letterSpacing: 1.3, color: colors.blue, fontWeight: '800' },
  title: { fontSize: 25, color: colors.navy, fontWeight: '800' },
  text: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  tabs: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 6, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: 'transparent', alignItems: 'center' },
  tabActive: { borderBottomColor: colors.blue },
  tabText: { color: colors.muted, fontSize: 12 },
  tabTextActive: { color: colors.blue, fontWeight: '800' },
  empty: { backgroundColor: colors.white, borderRadius: 18, padding: 25, gap: 12, borderColor: colors.border, borderWidth: 1 },
  emptyTitle: { fontSize: 20, color: colors.navy, fontWeight: '800' },
  link: { color: colors.blue, fontWeight: '800' },
});
