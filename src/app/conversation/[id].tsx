import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen, Avatar } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { demoProfessionals } from '@/features/demo/data';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pro = demoProfessionals.find((person) => person.id === id) ?? demoProfessionals[0];
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState<string[]>([]);
  return <AppScreen>
    <View style={styles.person}><Avatar name={pro.name} size={48} /><View><Text style={styles.name}>{pro.name}</Text><Text style={styles.meta}>{pro.job} · {pro.city}</Text></View></View>
    <View style={[styles.bubble, styles.received]}><Text style={styles.bubbleText}>Bonjour ! Merci pour votre message. Je serais ravi d’échanger avec vous sur votre projet.</Text></View>
    <View style={[styles.bubble, styles.outgoing]}><Text style={[styles.bubbleText, { color: colors.white }]}>Super ! Voici quelques photos de l’espace concerné.</Text></View>
    <View style={[styles.bubble, styles.received]}><Text style={styles.bubbleText}>Merci pour ces photos ! Nous pouvons affiner ensemble votre besoin et préparer un devis personnalisé.</Text></View>
    {sent.map((message, index) => <View key={`${index}-${message}`} style={[styles.bubble, styles.outgoing]}><Text style={[styles.bubbleText, { color: colors.white }]}>{message}</Text></View>)}
    <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} placeholder="Écrire un message…" placeholderTextColor={colors.muted} style={styles.input} /><Pressable onPress={() => { if (draft.trim()) { setSent([...sent, draft.trim()]); setDraft(''); } }} style={styles.send}><Ionicons name="send" size={20} color={colors.white} /></Pressable></View>
    <Text style={styles.disclaimer}>Aperçu local : les messages ne sont pas encore transmis.</Text>
  </AppScreen>;
}

const styles = StyleSheet.create({ person: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border }, name: { color: colors.navy, fontWeight: '800', fontSize: 16 }, meta: { color: colors.muted, fontSize: 13 }, bubble: { maxWidth: '82%', borderRadius: 17, padding: 14 }, received: { alignSelf: 'flex-start', backgroundColor: '#EAF2F6' }, outgoing: { alignSelf: 'flex-end', backgroundColor: colors.blue }, bubbleText: { color: colors.navy, fontSize: 15, lineHeight: 21 }, composer: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 20 }, input: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 30, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: colors.navy }, send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }, disclaimer: { color: colors.muted, textAlign: 'center', fontSize: 11 } });
