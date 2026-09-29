import type { ImagePickerAsset } from 'expo-image-picker';
import { prepareImage } from '@/features/media/prepare-image';
import { supabase } from '@/services/supabase/client';
import { logger } from '@/services/logger';

type WorkInput = {
  userId: string;
  title: string;
  description: string;
  city: string;
  categoryId: string;
  images: ImagePickerAsset[];
  onProgress: (message: string) => void;
};

export async function publishWork(input: WorkInput) {
  if (!supabase) throw new Error('Connexion à la base indisponible.');
  const client = supabase;
  const correlationId = logger.newCorrelationId();
  const title = input.title.trim();
  const body = input.description.trim();
  const city = input.city.trim();
  if (title.length < 2 || title.length > 120 || body.length < 1 || body.length > 2000
    || !city || city.length > 120 || !input.categoryId || input.images.length < 1
    || input.images.length > 10) {
    throw new Error('Complétez le titre, la description, la catégorie, la ville et les photos.');
  }
  input.onProgress('Création du brouillon…');
  const { data: post, error: createError } = await client.from('posts').insert({
    author_id: input.userId,
    title,
    body,
    city,
    category_id: input.categoryId,
    status: 'draft',
    visibility: 'network',
    in_portfolio: true,
  }).select('id').single();
  if (createError || !post) {
    logger.error('post.create_failed', { error: createError, correlationId, context: { operation: 'publish_post', step: 'create_draft' } });
    throw new Error('Publication refusée. Vérifiez que votre compte professionnel est validé.');
  }

  const uploaded: string[] = [];
  let step = 'prepare_image';
  try {
    for (let position = 0; position < input.images.length; position++) {
      input.onProgress(`Préparation de la photo ${position + 1}/${input.images.length}…`);
      const bytes = await prepareImage(input.images[position]);
      const path = `${input.userId}/${post.id}/${position}.jpg`;
      input.onProgress(`Envoi de la photo ${position + 1}/${input.images.length}…`);
      step = 'upload_image';
      const { error: uploadError } = await client.storage.from('post-images')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) { logger.error('media.upload_failed', { error: uploadError, correlationId, context: { bucket: 'post-images', operation: 'publish_post' } }); throw new Error('L’envoi des photos a échoué. Réessayez.'); }
      uploaded.push(path);
      step = 'save_image_relation';
      const { error: imageError } = await client.from('post_images')
        .insert({ post_id: post.id, storage_path: path, position });
      if (imageError) throw new Error('Impossible d’associer une photo à la publication.');
      input.onProgress(`${Math.round(((position + 1) / input.images.length) * 100)} % des photos envoyées`);
    }
    input.onProgress('Publication en cours…');
    step = 'publish';
    const { error: publishError } = await client.from('posts').update({ status: 'published' }).eq('id', post.id);
    if (publishError) throw new Error('Impossible de publier la réalisation.');
    return post.id;
  } catch (error) {
    logger.error('post.publish_failed', { error, correlationId, context: { operation: 'publish_post', step } });
    const { data: current } = await client.from('posts').select('status').eq('id', post.id).maybeSingle();
    if (current?.status === 'published') return post.id;
    if (uploaded.length) await client.storage.from('post-images').remove(uploaded);
    await client.from('posts').delete().eq('id', post.id);
    throw error;
  }
}
