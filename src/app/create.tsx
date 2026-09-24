import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen, Field, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';

export default function CreateScreen() {
  const [kind, setKind] = useState<'work' | 'need'>('work');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  return <AppScreen title="Publier" subtitle="Partagez une réalisation ou exprimez votre besoin.">
    <View style={styles.segment}>{([['work', 'Une réalisation'], ['need', 'Un besoin']] as const).map(([key, label]) => <Pressable key={key} onPress={() => setKind(key)} style={[styles.segmentItem, kind === key && styles.segmentActive]}><Text style={[styles.segmentText, kind === key && styles.segmentTextActive]}>{label}</Text></Pressable>)}</View>
    <View style={styles.card}>
      <Text style={styles.heading}>{kind === 'work' ? 'Montrez votre savoir-faire' : 'Décrivez votre projet'}</Text>
      <Text style={styles.description}>{kind === 'work' ? 'Quelques photos et quelques mots suffisent pour inspirer votre réseau.' : 'Racontez votre besoin pour trouver le bon professionnel près de chez vous.'}</Text>
      <Pressable style={styles.upload} onPress={() => Alert.alert('Photos', 'L’ajout de photos sera disponible avec la connexion Supabase Storage.')}><Ionicons name="images-outline" size={32} color={colors.blue} /><Text style={styles.uploadText}>Ajouter des photos</Text><Text style={styles.hint}>Photo de votre réalisation ou de votre projet</Text></Pressable>
      <Field label="Titre" value={title} onChangeText={setTitle} placeholder={kind === 'work' ? 'Ex. Terrasse en bois sur mesure' : 'Ex. Je cherche un menuisier'} />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Décrivez en quelques mots…" multiline maxLength={2000} />
      <Field label="Ville" value={city} onChangeText={setCity} placeholder="Ex. Dijon" />
      <PrimaryButton title="Continuer" icon="arrow-forward" onPress={() => router.push('/login')} disabled={!title.trim() || !description.trim() || !city.trim()} />
      <Text style={styles.hint}>Connectez-vous pour publier. Les droits professionnels seront vérifiés côté serveur.</Text>
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  segment: { backgroundColor: colors.pale, borderRadius: 14, padding: 4, flexDirection: 'row' }, segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 11 }, segmentActive: { backgroundColor: colors.blue }, segmentText: { color: colors.navy, fontWeight: '700' }, segmentTextActive: { color: colors.white },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 19, padding: 17, gap: 15 }, heading: { color: colors.navy, fontSize: 21, fontWeight: '800' }, description: { color: colors.muted, lineHeight: 21, marginTop: -8 },
  upload: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#9CBBC8', backgroundColor: colors.background, minHeight: 145, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 5 }, uploadText: { color: colors.blue, fontWeight: '800' }, hint: { color: colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
