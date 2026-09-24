import { useState } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { Field, MainScreen, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { publishNeed } from '@/features/requests/publish-need';
import { supabase } from '@/services/supabase/client';

export function NeedForm() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [budget, setBudget] = useState('');
  const [date, setDate] = useState('');
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const categories = useQuery({
    queryKey: ['professional-categories'],
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('professional_categories').select('id,name').order('name');
      if (error) throw error;
      return data;
    },
  });

  async function addPhotos() {
    if (busy || images.length >= 5) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: true,
        selectionLimit: 5 - images.length, quality: 1,
      });
      if (!result.canceled && result.assets) setImages((current) => [...current, ...result.assets].slice(0, 5));
    } catch {
      Alert.alert('Photos indisponibles', 'Impossible d’ouvrir la galerie pour le moment.');
    }
  }

  async function submit() {
    if (!session || busy) return;
    setBusy(true);
    try {
      await publishNeed({
        userId: session.user.id, title, description, city, categoryId,
        budgetEuros: budget, desiredBy: date, images, onProgress: setProgress,
      });
      await queryClient.invalidateQueries({ queryKey: ['service-requests'] });
      setTitle(''); setDescription(''); setCity(''); setCategoryId('');
      setBudget(''); setDate(''); setImages([]);
      Alert.alert('Besoin publié', 'Votre demande est visible par les professionnels.');
      router.replace('/explore');
    } catch (error) {
      Alert.alert('Publication impossible', error instanceof Error ? error.message : 'Réessayez plus tard.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  return <MainScreen title="Publier un besoin" subtitle="Décrivez votre projet pour trouver un artisan local.">
    <View style={styles.card}>
      <Field label="Titre du projet" value={title} onChangeText={setTitle} placeholder="Ex. Bibliothèque sur mesure" maxLength={150} editable={!busy} />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Décrivez vos attentes, dimensions et matériaux…" multiline maxLength={3000} editable={!busy} />
      <Text style={styles.label}>Catégorie</Text>
      {categories.isPending ? <ActivityIndicator color={colors.blue} /> : categories.error ? <Text style={styles.hint}>Impossible de charger les catégories.</Text> : <View style={styles.categories}>
        {categories.data?.map((category) => <Pressable key={category.id} style={[styles.category, categoryId === category.id && styles.categoryActive]} onPress={() => setCategoryId(category.id)} disabled={busy} accessibilityRole="radio" accessibilityState={{ selected: categoryId === category.id }}><Text style={[styles.categoryText, categoryId === category.id && styles.categoryTextActive]}>{category.name}</Text></Pressable>)}
      </View>}
      <Field label="Ville" value={city} onChangeText={setCity} placeholder="Ville du projet" maxLength={120} editable={!busy} />
      <Field label="Budget maximal en euros (facultatif)" value={budget} onChangeText={setBudget} placeholder="Ex. 2500" keyboardType="decimal-pad" editable={!busy} />
      <Field label="Date souhaitée (facultatif)" value={date} onChangeText={setDate} placeholder="AAAA-MM-JJ" keyboardType="numbers-and-punctuation" maxLength={10} editable={!busy} />
      <Text style={styles.label}>Photos du projet (facultatif, 5 maximum)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
        {images.map((asset, index) => <View key={`${asset.uri}-${index}`} style={styles.photoWrap}>
          <Image source={{ uri: asset.uri }} contentFit="cover" style={styles.photo} />
          <Pressable style={styles.remove} onPress={() => setImages((current) => current.filter((_, position) => position !== index))} disabled={busy} accessibilityLabel={`Retirer la photo ${index + 1}`}><Text style={styles.removeText}>×</Text></Pressable>
        </View>)}
        {images.length < 5 && <Pressable style={styles.addPhoto} onPress={() => void addPhotos()} disabled={busy} accessibilityRole="button"><Text style={styles.plus}>＋</Text><Text style={styles.addText}>Ajouter des photos</Text></Pressable>}
      </ScrollView>
      {progress ? <Text style={styles.progress}>{progress}</Text> : null}
      <PrimaryButton title={busy ? 'Publication en cours…' : 'Publier mon besoin'} onPress={() => void submit()} disabled={busy || title.trim().length < 5 || description.trim().length < 10 || !city.trim() || !categoryId} />
    </View>
  </MainScreen>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderColor: colors.divider, borderWidth: 1, borderRadius: 16, padding: 16, gap: 16 },
  label: { color: colors.navy, fontSize: 14, fontWeight: '700', marginBottom: -8 },
  hint: { color: colors.muted, fontSize: 13 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { backgroundColor: colors.pale, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10 },
  categoryActive: { backgroundColor: colors.blue },
  categoryText: { color: colors.navy, fontSize: 13 },
  categoryTextActive: { color: colors.white, fontWeight: '700' },
  photos: { gap: 10 },
  photoWrap: { width: 112, height: 112 },
  photo: { width: 112, height: 112, borderRadius: 12 },
  remove: { position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.white, fontSize: 22, lineHeight: 26 },
  addPhoto: { width: 112, height: 112, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', padding: 6 },
  plus: { color: colors.blue, fontSize: 28 },
  addText: { color: colors.blue, fontWeight: '600', fontSize: 12, textAlign: 'center' },
  progress: { color: colors.blue, textAlign: 'center', fontWeight: '600' },
});
