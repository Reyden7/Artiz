import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppScreen, EmptyState, Field, PrimaryButton } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { logger } from '@/services/logger';
import { useAuth } from '@/features/auth/auth-context';
import { prepareImage } from '@/features/media/prepare-image';
import { supabase } from '@/services/supabase/client';

type Photo = { kind: 'existing'; path: string; uri: string } |
  { kind: 'new'; asset: ImagePicker.ImagePickerAsset };

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [draftTitle, setTitle] = useState<string | null>(null);
  const [draftDescription, setDescription] = useState<string | null>(null);
  const [draftCity, setCity] = useState<string | null>(null);
  const [draftCategoryId, setCategoryId] = useState<string | null>(null);
  const [draftPhotos, setPhotos] = useState<Photo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const post = useQuery({
    queryKey: ['post-editor', id, session?.user.id],
    enabled: Boolean(supabase && id && session),
    queryFn: async () => {
      if (!supabase || !id || !session) return null;
      const { data, error } = await supabase.from('posts')
        .select('id,author_id,status,title,body,city,category_id')
        .eq('id', id).eq('author_id', session.user.id).maybeSingle();
      if (error) throw error;
      if (!data || data.status !== 'published') return null;
      const { data: images, error: imageError } = await supabase.from('post_images')
        .select('storage_path,position').eq('post_id', id).order('position');
      if (imageError) throw imageError;
      const existing = await Promise.all(images.map(async (image) => {
        const { data: url, error: urlError } = await supabase!.storage.from('post-images')
          .createSignedUrl(image.storage_path, 600);
        if (urlError || !url) throw urlError ?? new Error('Photo indisponible');
        return { kind: 'existing' as const, path: image.storage_path, uri: url.signedUrl };
      }));
      return { ...data, photos: existing };
    },
  });
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

  const title = draftTitle ?? post.data?.title ?? '';
  const description = draftDescription ?? post.data?.body ?? '';
  const city = draftCity ?? post.data?.city ?? '';
  const categoryId = draftCategoryId ?? post.data?.category_id ?? '';
  const photos = draftPhotos ?? post.data?.photos ?? [];

  async function addPhotos() {
    if (busy || photos.length >= 10) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: true,
        selectionLimit: 10 - photos.length, quality: 1,
      });
      if (!result.canceled) setPhotos((current) => [...(current ?? post.data?.photos ?? []),
        ...result.assets.map((asset) => ({ kind: 'new' as const, asset }))].slice(0, 10));
    } catch {
      Alert.alert('Photos indisponibles', 'Impossible d’ouvrir la galerie pour le moment.');
    }
  }

  async function save() {
    if (!supabase || !id || !session || busy) return;
    if (title.trim().length < 2 || description.trim().length < 1 || !city.trim()
      || !categoryId || photos.length < 1 || photos.length > 10) {
      Alert.alert('Publication incomplète', 'Renseignez le titre, la description, la catégorie, la ville et au moins une photo.');
      return;
    }
    setBusy(true);
    const uploaded: string[] = [];
    let committed = false;
    try {
      const paths: string[] = [];
      for (const [position, photo] of photos.entries()) {
        if (photo.kind === 'existing') { paths.push(photo.path); continue; }
        setProgress(`Envoi de la photo ${position + 1}/${photos.length}…`);
        const bytes = await prepareImage(photo.asset);
        const path = `${session.user.id}/${id}/edit-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error } = await supabase.storage.from('post-images')
          .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
        uploaded.push(path);
        paths.push(path);
      }
      setProgress('Mise à jour de la publication…');
      const { data: unused, error } = await supabase.rpc('replace_own_post', {
        target_post: id, new_title: title.trim(), new_body: description.trim(),
        new_category: categoryId, new_city: city.trim(), image_paths: paths,
      });
      if (error) throw error;
      committed = true;
      const cleanup = unused.length ? await supabase.storage.from('post-images').remove(unused) : null;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['post', id] }),
        queryClient.invalidateQueries({ queryKey: ['posts-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['professional', session.user.id] }),
      ]);
      router.replace({ pathname: '/post/[id]', params: { id } });
      if (cleanup?.error) Alert.alert('Publication modifiée', 'Certaines anciennes photos n’ont pas pu être effacées du stockage.');
    } catch (error) {
      logger.error('post.edit_failed', { error, context: { operation: 'edit_post' } });
      if (!committed && uploaded.length) await supabase.storage.from('post-images').remove(uploaded);
      Alert.alert('Modification impossible', error instanceof Error ? error.message : 'Réessayez plus tard.');
    } finally { setBusy(false); setProgress(''); }
  }

  return <AppScreen title="Modifier la publication">
    {post.isPending ? <ActivityIndicator color={colors.blue} /> : post.error || !post.data
      ? <EmptyState icon="lock-closed-outline" title="Publication inaccessible" description="Seul son auteur peut la modifier." />
      : <View style={styles.card}>
        <Text style={styles.label}>Photos ({photos.length}/10)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {photos.map((photo, index) => <View key={photo.kind === 'existing' ? photo.path : `${photo.asset.uri}-${index}`} style={styles.photoWrap}>
            <Image source={{ uri: photo.kind === 'existing' ? photo.uri : photo.asset.uri }} contentFit="cover" style={styles.photo} />
            <Pressable style={styles.remove} accessibilityLabel={`Retirer la photo ${index + 1}`} disabled={busy}
              onPress={() => setPhotos((current) => (current ?? post.data?.photos ?? []).filter((_, i) => i !== index))}><Text style={styles.removeText}>×</Text></Pressable>
          </View>)}
          {photos.length < 10 && <Pressable style={styles.addPhoto} onPress={() => void addPhotos()} disabled={busy}><Text style={styles.addText}>＋ Ajouter</Text></Pressable>}
        </ScrollView>
        <Field label="Titre" value={title} onChangeText={setTitle} maxLength={120} editable={!busy} />
        <Field label="Description" value={description} onChangeText={setDescription} multiline maxLength={2000} editable={!busy} />
        <Text style={styles.label}>Catégorie</Text>
        {categories.data?.map((category) => <Pressable key={category.id} style={[styles.category, categoryId === category.id && styles.selected]}
          accessibilityRole="radio" accessibilityState={{ selected: categoryId === category.id }} disabled={busy}
          onPress={() => setCategoryId(category.id)}><Text style={categoryId === category.id ? styles.selectedText : styles.categoryText}>{category.name}</Text></Pressable>)}
        <Field label="Ville" value={city} onChangeText={setCity} maxLength={120} editable={!busy} />
        {progress && <Text style={styles.progress}>{progress}</Text>}
        <PrimaryButton title={busy ? 'Enregistrement…' : 'Enregistrer'} onPress={() => void save()} disabled={busy || !post.data} />
      </View>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, padding: 16, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, gap: 14 },
  label: { color: colors.navy, fontWeight: '700' }, photos: { gap: 10 },
  photoWrap: { width: 112, height: 112 }, photo: { width: 112, height: 112, borderRadius: 12 },
  remove: { position: 'absolute', right: 4, top: 4, backgroundColor: colors.navy, borderRadius: 16, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.white, fontSize: 21 },
  addPhoto: { width: 112, height: 112, borderColor: colors.border, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  addText: { color: colors.blue, fontWeight: '700' },
  category: { padding: 10, backgroundColor: colors.pale, borderRadius: 10 },
  selected: { backgroundColor: colors.blue }, selectedText: { color: colors.white }, categoryText: { color: colors.navy },
  progress: { color: colors.blue, textAlign: 'center' },
});
