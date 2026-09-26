import type { ImagePickerAsset } from 'expo-image-picker';
import { prepareImage } from '@/features/media/prepare-image';
import { supabase } from '@/services/supabase/client';

export async function avatarUrl(path: string | null | undefined) {
  if (!supabase || !path) return null;
  const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, 600);
  if (error) return null;
  return data.signedUrl;
}

export async function uploadAvatar(userId: string, asset: ImagePickerAsset) {
  if (!supabase) throw new Error('Connexion indisponible.');
  const bytes = await prepareImage(asset, 512);
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('La photo de profil doit faire moins de 5 Mo.');
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error('Impossible d’envoyer la photo de profil.');
  return path;
}
