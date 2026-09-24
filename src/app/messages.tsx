import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen, Avatar } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';

export default function MessagesScreen() {
  return <AppScreen title="Messages" subtitle="Échangez simplement autour de vos projets.">
    <Pressable style={styles.thread} onPress={() => router.push('/conversation/thomas-moreau')}><Avatar name="Thomas Moreau" size={54} /><View style={{ flex: 1 }}><View style={styles.line}><Text style={styles.name}>Thomas Moreau</Text><Text style={styles.time}>09:28</Text></View><Text style={styles.meta}>Menuisier · Annecy (74)</Text><Text style={styles.preview}>Parfait ! Seriez-vous disponible la semaine prochaine ?</Text></View><View style={styles.dot} /></Pressable>
    <View style={styles.note}><Text style={styles.noteTitle}>Une belle idée commence par un échange.</Text><Text style={styles.noteText}>Découvrez un professionnel et contactez-le directement depuis son profil.</Text></View>
  </AppScreen>;
}

const styles = StyleSheet.create({ thread: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, line: { flexDirection: 'row', justifyContent: 'space-between' }, name: { fontSize: 16, color: colors.navy, fontWeight: '800' }, time: { fontSize: 12, color: colors.muted }, meta: { color: colors.muted, fontSize: 12, marginTop: 2 }, preview: { color: colors.navy, fontSize: 13, marginTop: 7 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue }, note: { padding: 22, backgroundColor: colors.pale, borderRadius: 16, gap: 7 }, noteTitle: { color: colors.navy, fontSize: 17, fontWeight: '800' }, noteText: { color: colors.muted, lineHeight: 20 } });
