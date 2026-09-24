import { useState } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { EmptyState, Field, MainScreen, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { useAccountType } from '@/features/auth/use-account-type';
import { publishWork } from '@/features/posts/publish-work';
import { NeedForm } from '@/features/requests/need-form';
import { supabase } from '@/services/supabase/client';

export default function CreateScreen() {
  const { session } = useAuth();
  const account = useAccountType();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const status = useQuery({
    queryKey: ['professional-verification', session?.user.id],
    enabled: Boolean(supabase && session && account.data === 'professional'),
    queryFn: async () => {
      if (!supabase || !session) return null;
      const { data, error } = await supabase.from('professional_profiles')
        .select('verification_status').eq('user_id', session.user.id).single();
      if (error) throw error;
      return data.verification_status;
    },
  });
  const categories = useQuery({
    queryKey: ['professional-categories'],
    enabled: Boolean(supabase && status.data === 'verified'),
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('professional_categories')
        .select('id,name').order('name');
      if (error) throw error;
      return data;
    },
  });

  async function addPhotos() {
    if (busy || images.length >= 10) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 10 - images.length,
        quality: 1,
      });
      if (!result.canceled && result.assets) {
        setImages((current) => [...current, ...result.assets].slice(0, 10));
      }
    } catch {
      Alert.alert('Photos indisponibles', 'Impossible d’ouvrir la galerie pour le moment.');
    }
  }

  async function submit() {
    if (busy || !session) return;
    setBusy(true);
    try {
      await publishWork({
        userId: session.user.id,
        title,
        description,
        city,
        categoryId,
        images,
        onProgress: setProgress,
      });
      await queryClient.invalidateQueries({ queryKey: ['posts-feed'] });
      setTitle(''); setDescription(''); setCity(''); setCategoryId(''); setImages([]);
      Alert.alert('Réalisation publiée', 'Votre publication apparaît maintenant dans le fil.');
      router.replace('/home');
    } catch (error) {
      Alert.alert('Publication impossible', error instanceof Error ? error.message : 'Réessayez plus tard.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  if (account.isPending || (account.data === 'professional' && status.isPending)) {
    return <MainScreen title="Publier"><ActivityIndicator color={colors.blue} /></MainScreen>;
  }
  if (account.error || status.error) {
    return <MainScreen title="Publier"><EmptyState icon="alert-circle-outline" title="Compte indisponible" description="Impossible de vérifier vos droits pour le moment." /></MainScreen>;
  }
  if (account.data === 'customer') {
    return <NeedForm />;
  }
  if (status.data !== 'verified') {
    return <MainScreen title="Publier une réalisation">
      <EmptyState icon="time-outline" title="Compte en attente de validation" description="Votre entreprise a bien été identifiée. Votre compte professionnel est en attente de validation." />
    </MainScreen>;
  }

  return <MainScreen title="Créer une publication" subtitle="Partagez une réalisation avec le réseau Artiz.">
    <View style={styles.card}>
      <Text style={styles.heading}>Votre réalisation</Text>
      <Text style={styles.hint}>Ajoutez de 1 à 10 photos. Elles sont redimensionnées et compressées avant l’envoi.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
        {images.map((asset, index) => <View key={`${asset.uri}-${index}`} style={styles.photoWrap}>
          <Image source={{ uri: asset.uri }} contentFit="cover" style={styles.photo} />
          <Pressable style={styles.remove} onPress={() => setImages((current) => current.filter((_, position) => position !== index))} disabled={busy} accessibilityLabel={`Retirer la photo ${index + 1}`}>
            <Text style={styles.removeText}>×</Text>
          </Pressable>
        </View>)}
        {images.length < 10 && <Pressable style={styles.addPhoto} onPress={() => void addPhotos()} disabled={busy} accessibilityRole="button"><Text style={styles.plus}>＋</Text><Text style={styles.addText}>Ajouter des photos</Text></Pressable>}
      </ScrollView>
      <Field label="Titre" value={title} onChangeText={setTitle} placeholder="Titre de votre réalisation" maxLength={120} editable={!busy} />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Décrivez votre travail et les matériaux utilisés…" multiline maxLength={2000} editable={!busy} />
      <Text style={styles.label}>Catégorie</Text>
      {categories.isPending ? <ActivityIndicator color={colors.blue} /> : categories.error ? <Text style={styles.hint}>Impossible de charger les catégories.</Text> : <View style={styles.categories}>
        {categories.data?.map((category) => <Pressable key={category.id} style={[styles.category, categoryId === category.id && styles.categoryActive]} onPress={() => setCategoryId(category.id)} disabled={busy} accessibilityRole="radio" accessibilityState={{ selected: categoryId === category.id }}><Text style={[styles.categoryText, categoryId === category.id && styles.categoryTextActive]}>{category.name}</Text></Pressable>)}
      </View>}
      <Field label="Ville" value={city} onChangeText={setCity} placeholder="Ville de la réalisation" maxLength={120} editable={!busy} />
      {progress ? <Text style={styles.progress}>{progress}</Text> : null}
      <PrimaryButton title={busy ? 'Publication en cours…' : 'Publier la réalisation'} onPress={() => void submit()} disabled={busy || !title.trim() || !description.trim() || !city.trim() || !categoryId || images.length === 0} />
    </View>
  </MainScreen>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderColor: colors.divider, borderWidth: 1, borderRadius: 16, padding: 16, gap: 16 },
  heading: { color: colors.navy, fontSize: 20, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  photos: { gap: 10 },
  photoWrap: { width: 112, height: 112 },
  photo: { width: 112, height: 112, borderRadius: 12 },
  remove: { position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.white, fontSize: 22, lineHeight: 26 },
  addPhoto: { width: 112, height: 112, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', padding: 6 },
  plus: { color: colors.blue, fontSize: 28 },
  addText: { color: colors.blue, fontWeight: '600', fontSize: 12, textAlign: 'center' },
  label: { color: colors.navy, fontSize: 14, fontWeight: '700', marginBottom: -8 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { backgroundColor: colors.pale, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10 },
  categoryActive: { backgroundColor: colors.blue },
  categoryText: { color: colors.navy, fontSize: 13 },
  categoryTextActive: { color: colors.white, fontWeight: '700' },
  progress: { color: colors.blue, textAlign: 'center', fontWeight: '600' },
});
