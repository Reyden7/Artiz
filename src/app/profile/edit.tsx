import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { AppScreen, Field, PrimaryButton } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { avatarUrl, uploadAvatar } from '@/features/profiles/avatars';
import { supabase } from '@/services/supabase/client';

export default function EditProfileScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const initializedFor = useRef<string | null>(null);
  const profile = useQuery({
    queryKey: ['profile-edit', userId], enabled: Boolean(supabase && userId),
    queryFn: async () => {
      if (!supabase || !userId) return null;
      const [person, business] = await Promise.all([
        supabase.from('profiles').select('display_name,bio,city,avatar_path,account_type').eq('id', userId).single(),
        supabase.from('professional_profiles').select('headline,description,verification_status').eq('user_id', userId).maybeSingle(),
      ]);
      if (person.error) throw person.error;
      if (business.error) throw business.error;
      const avatar = await avatarUrl(person.data.avatar_path);
      return { ...person.data, business: business.data, avatar };
    },
  });
  useEffect(() => {
    if (!userId || !profile.data || initializedFor.current === userId) return;
    initializedFor.current = userId;
    setName(profile.data.display_name); setBio(profile.data.bio ?? ''); setCity(profile.data.city ?? '');
    setHeadline(profile.data.business?.headline ?? ''); setDescription(profile.data.business?.description ?? '');
  }, [profile.data, userId]);

  async function selectPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  async function save() {
    if (!supabase || !userId || !profile.data || busy) return;
    if (name.trim().length < 2 || name.trim().length > 80 || bio.trim().length > 500 || city.trim().length > 120 || headline.trim().length > 160 || description.trim().length > 2000) {
      Alert.alert('Profil incomplet', 'Vérifiez le nom et la longueur des champs.'); return;
    }
    setBusy(true);
    let uploaded: string | null = null;
    let businessSaved = false;
    try {
      if (photo) uploaded = await uploadAvatar(userId, photo);
      if (profile.data.business?.verification_status === 'verified') {
        const { error: businessError } = await supabase.from('professional_profiles')
          .update({ headline: headline.trim() || null, description: description.trim() || null }).eq('user_id', userId).select('user_id').single();
        if (businessError) throw businessError;
        businessSaved = true;
      }
      const { error } = await supabase.from('profiles').update({
        display_name: name.trim(), bio: bio.trim() || null, city: city.trim() || null,
        ...(uploaded ? { avatar_path: uploaded } : {}),
      }).eq('id', userId).select('id').single();
      if (error) throw error;
      if (uploaded && profile.data.avatar_path) await supabase.storage.from('avatars').remove([profile.data.avatar_path]);
      await queryClient.invalidateQueries({ queryKey: ['my-profile', userId] });
      await queryClient.invalidateQueries({ queryKey: ['professional', userId] });
      Alert.alert('Profil enregistré');
      router.back();
    } catch (error) {
      if (uploaded) await supabase.storage.from('avatars').remove([uploaded]);
      if (businessSaved) await queryClient.invalidateQueries({ queryKey: ['professional', userId] });
      Alert.alert(businessSaved ? 'Enregistrement partiel' : 'Enregistrement impossible',
        businessSaved ? 'Les informations professionnelles sont enregistrées. Le reste du profil n’a pas pu être mis à jour : réessayez.'
          : error instanceof Error ? error.message : 'Réessayez plus tard.');
    } finally { setBusy(false); }
  }

  return <AppScreen title="Modifier mon profil">
    {profile.isPending ? <ActivityIndicator color={colors.blue} /> : profile.error || !profile.data ? <Text>Profil indisponible.</Text> : <View style={styles.card}>
      <Pressable onPress={() => void selectPhoto()} disabled={busy} style={styles.photoAction} accessibilityRole="button">
        {photo || profile.data.avatar ? <Image source={{ uri: photo?.uri ?? profile.data.avatar! }} contentFit="cover" style={styles.photo} /> : <View style={styles.photo}><Text style={styles.photoText}>＋</Text></View>}
        <Text style={styles.link}>Changer la photo de profil</Text>
      </Pressable>
      <Field label="Nom public" value={name} onChangeText={setName} maxLength={80} editable={!busy} />
      <Field label="Biographie" value={bio} onChangeText={setBio} multiline maxLength={500} editable={!busy} placeholder="Présentez-vous en quelques mots" />
      <Field label="Ville" value={city} onChangeText={setCity} maxLength={120} editable={!busy} />
      {profile.data.account_type === 'professional' && profile.data.business?.verification_status === 'verified' ? <>
        <Field label="Accroche professionnelle" value={headline} onChangeText={setHeadline} maxLength={160} editable={!busy} />
        <Field label="À propos de votre activité" value={description} onChangeText={setDescription} multiline maxLength={2000} editable={!busy} />
      </> : null}
      <Text style={styles.hint}>Votre nom, votre ville, votre biographie et votre photo sont visibles par les membres connectés.</Text>
      <PrimaryButton title={busy ? 'Enregistrement…' : 'Enregistrer'} onPress={() => void save()} disabled={busy} />
    </View>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 16, gap: 16 },
  photoAction: { alignItems: 'center', gap: 8 },
  photo: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  photoText: { color: colors.blue, fontSize: 32 },
  link: { color: colors.blue, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});
