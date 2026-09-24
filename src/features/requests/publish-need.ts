import type { ImagePickerAsset } from 'expo-image-picker';
import { prepareImage } from '@/features/media/prepare-image';
import { supabase } from '@/services/supabase/client';

type NeedInput = {
  userId: string;
  title: string;
  description: string;
  city: string;
  categoryId: string;
  budgetEuros: string;
  desiredBy: string;
  images: ImagePickerAsset[];
  onProgress: (message: string) => void;
};

export async function publishNeed(input: NeedInput) {
  if (!supabase) throw new Error('Connexion à la base indisponible.');
  const client = supabase;
  const title = input.title.trim();
  const description = input.description.trim();
  const city = input.city.trim();
  const budget = input.budgetEuros.trim();
  const date = input.desiredBy.trim();
  const budgetNumber = budget ? Number(budget.replace(',', '.')) : null;
  if (title.length < 5 || title.length > 150 || description.length < 10 || description.length > 3000
    || !city || city.length > 120 || !input.categoryId || input.images.length > 5) {
    throw new Error('Complétez le titre, la description, la catégorie et la ville.');
  }
  if (budget && (budgetNumber === null || !Number.isFinite(budgetNumber) || budgetNumber < 0 || budgetNumber > 10_000_000)) {
    throw new Error('Le budget indiqué est invalide.');
  }
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date < new Date().toISOString().slice(0, 10))) {
    throw new Error('Indiquez une date future au format AAAA-MM-JJ.');
  }
  input.onProgress('Création du brouillon…');
  const { data: request, error: createError } = await client.from('service_requests').insert({
    customer_id: input.userId,
    title,
    description,
    city,
    category_id: input.categoryId,
    budget_max_cents: budgetNumber === null ? null : Math.round(budgetNumber * 100),
    desired_by: date || null,
    visibility: 'public',
    status: 'draft',
  }).select('id').single();
  if (createError || !request) throw new Error('Impossible de créer votre besoin. Vérifiez votre compte.');

  const uploaded: string[] = [];
  try {
    for (let position = 0; position < input.images.length; position++) {
      input.onProgress(`Préparation de la photo ${position + 1}/${input.images.length}…`);
      const bytes = await prepareImage(input.images[position]);
      const path = `${input.userId}/${request.id}/${position}.jpg`;
      input.onProgress(`Envoi de la photo ${position + 1}/${input.images.length}…`);
      const { error: uploadError } = await client.storage.from('request-images')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw new Error('L’envoi des photos a échoué. Réessayez.');
      uploaded.push(path);
      const { error: imageError } = await client.from('service_request_images')
        .insert({ request_id: request.id, storage_path: path, position });
      if (imageError) throw new Error('Impossible d’associer une photo au besoin.');
      input.onProgress(`${Math.round(((position + 1) / input.images.length) * 100)} % des photos envoyées`);
    }
    input.onProgress('Publication en cours…');
    const { error: publishError } = await client.from('service_requests')
      .update({ status: 'open' }).eq('id', request.id);
    if (publishError) throw new Error('Impossible de publier le besoin.');
    return request.id;
  } catch (error) {
    const { data: current } = await client.from('service_requests').select('status').eq('id', request.id).maybeSingle();
    if (current?.status === 'open') return request.id;
    if (uploaded.length) await client.storage.from('request-images').remove(uploaded);
    await client.from('service_requests').delete().eq('id', request.id);
    throw error;
  }
}
