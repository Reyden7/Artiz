import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen, Avatar, SectionTitle } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { demoProfessionals } from '@/features/demo/data';


export default function NetworkScreen() {
  const [followed, setFollowed] = useState<string[]>([]);
  return <AppScreen title="Mon réseau" subtitle="Les professionnels et les idées qui vous inspirent.">
    <View style={styles.intro}><Text style={styles.introTitle}>Grandissons ensemble.</Text><Text style={styles.introText}>Suivez les artisans qui vous inspirent et découvrez leurs dernières réalisations.</Text></View>
    <SectionTitle title="Suggestions pour vous" />
    {demoProfessionals.map((person) => <View key={person.name} style={styles.person}><Avatar name={person.name} size={50} /><Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/professional/[id]', params: { id: person.id } })}><Text style={styles.name}>{person.name}</Text><Text style={styles.meta}>{person.job} · {person.city}</Text></Pressable><Pressable onPress={() => setFollowed(followed.includes(person.name) ? followed.filter((name) => name !== person.name) : [...followed, person.name])} style={[styles.follow, followed.includes(person.name) && styles.followed]}><Text style={[styles.followText, followed.includes(person.name) && styles.followedText]}>{followed.includes(person.name) ? 'Suivi' : '+ Suivre'}</Text></Pressable></View>)}
    <SectionTitle title="Votre activité" />
    <View style={styles.empty}><Text style={styles.name}>{followed.length ? `${followed.length} professionnel${followed.length > 1 ? 's' : ''} suivi${followed.length > 1 ? 's' : ''}` : 'Votre réseau commence ici'}</Text><Text style={styles.meta}>Les nouvelles publications de vos contacts apparaîtront ici.</Text></View>
  </AppScreen>;
}

const styles = StyleSheet.create({ intro: { backgroundColor: colors.pale, padding: 20, borderRadius: 18, gap: 5 }, introTitle: { fontSize: 22, fontWeight: '800', color: colors.navy }, introText: { color: colors.muted, lineHeight: 21 }, person: { backgroundColor: colors.white, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: colors.border }, name: { color: colors.navy, fontWeight: '800', fontSize: 16 }, meta: { color: colors.muted, fontSize: 13, marginTop: 3 }, follow: { borderWidth: 1, borderColor: colors.blue, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 }, followed: { backgroundColor: colors.blue }, followText: { color: colors.blue, fontWeight: '700', fontSize: 12 }, followedText: { color: colors.white }, empty: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 20, gap: 4 } });
