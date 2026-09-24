import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { MainScreen, Field, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';

export default function CreateScreen() {
  const [kind, setKind] = useState<'work' | 'need'>('work');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  return <MainScreen title="Publier" subtitle="Partagez une réalisation ou exprimez votre besoin.">
    <View style={styles.segment}>{([['work', 'Une réalisation'], ['need', 'Un besoin']] as const).map(([key, label]) => <Pressable key={key} onPress={() => setKind(key)} style={[styles.segmentItem, kind === key && styles.segmentActive]}><Text style={[styles.segmentText, kind === key && styles.segmentTextActive]}>{label}</Text></Pressable>)}</View>
    <View style={styles.card}>
      <Text style={styles.heading}>{kind === 'work' ? 'Montrez votre savoir-faire' : 'Décrivez votre projet'}</Text>
      <Text style={styles.description}>{kind === 'work' ? 'Quelques photos et quelques mots suffisent pour inspirer votre réseau.' : 'Racontez votre besoin pour trouver le bon professionnel près de chez vous.'}</Text>
      <Pressable style={styles.upload} onPress={() => Alert.alert('Photos', 'L’ajout de photos sera disponible avec la connexion Supabase Storage.')}><Ionicons name="images-outline" size={32} color={colors.blue} /><Text style={styles.uploadText}>Ajouter des photos</Text><Text style={styles.hint}>Photo de votre réalisation ou de votre projet</Text></Pressable>
      <Field label="Titre" value={title} onChangeText={setTitle} placeholder={kind === 'work' ? 'Titre de votre réalisation' : 'Titre de votre projet'} />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Décrivez en quelques mots…" multiline maxLength={2000} />
      <Field label="Ville" value={city} onChangeText={setCity} placeholder="Votre ville" />
      <PrimaryButton title="Continuer" icon="arrow-forward" onPress={() => Alert.alert('Publication indisponible', 'L’envoi des publications sera disponible lorsque ce service sera activé.')} disabled={!title.trim() || !description.trim() || !city.trim()} />
      <Text style={styles.hint}>Les droits professionnels seront vérifiés côté serveur avant publication.</Text>
    </View>
  </MainScreen>;
}

const styles = StyleSheet.create({
  segment: { backgroundColor: colors.pale, borderRadius: 12, padding: 4, flexDirection: 'row' }, segmentItem: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }, segmentActive: { backgroundColor: colors.blue }, segmentText: { color: colors.navy, fontWeight: '600' }, segmentTextActive: { color: colors.white },
  card: { backgroundColor: colors.white, borderColor: colors.divider, borderWidth: 1, borderRadius: 16, padding: 16, gap: 16 }, heading: { color: colors.navy, fontSize: 20, fontWeight: '700' }, description: { color: colors.muted, lineHeight: 22, marginTop: -8 },
  upload: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.backgroundWarm, minHeight: 144, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4 }, uploadText: { color: colors.blue, fontWeight: '700' }, hint: { color: colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
