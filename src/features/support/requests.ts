import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';
import { prepareImage } from '@/features/media/prepare-image';
import { supabase } from '@/services/supabase/client';
import type { SupportCategory } from '@/constants/support';

export type SupportRequestInput = {
  userId: string;
  category: SupportCategory;
  subject: string;
  description: string;
  contactEmail: string;
  screenPath?: string;
  screenshot?: ImagePickerAsset | null;
};

export async function createSupportRequest(input: SupportRequestInput) {
  if (!supabase) throw new Error('Service indisponible pour le moment.');
  const client = supabase;
  const subject = input.subject.trim();
  const description = input.description.trim();
  const contactEmail = input.contactEmail.trim();
  if (subject.length < 3 || subject.length > 120 || description.length < 10 || description.length > 4000) {
    throw new Error('Indiquez un sujet (3 à 120 caractères) et une description (10 à 4 000 caractères).');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new Error('Vérifiez votre adresse e-mail de contact.');
  }

  let screenshotPath: string | null = null;
  if (input.screenshot) {
    const bytes = await prepareImage(input.screenshot);
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('La capture dépasse 5 Mo. Choisissez une autre image.');
    screenshotPath = `${input.userId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await client.storage.from('support-screenshots')
      .upload(screenshotPath, bytes, { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error('Impossible d’envoyer la capture d’écran.');
  }

  const { data, error } = await client.from('support_requests').insert({
    user_id: input.userId,
    category: input.category,
    subject,
    description,
    contact_email: contactEmail,
    platform: Platform.OS,
    app_version: (Constants.expoConfig?.version ?? '1.0.0') + (__DEV__ ? '-dev' : ''),
    device_info: [Device.modelName, Device.osName, Device.osVersion ?? String(Platform.Version)].filter(Boolean).join(' · ').slice(0, 500),
    screen_path: input.screenPath?.slice(0, 300) || null,
    screenshot_path: screenshotPath,
  }).select('id').single();
  if (error || !data) {
    if (screenshotPath) await client.storage.from('support-screenshots').remove([screenshotPath]);
    throw new Error('Impossible d’envoyer la demande. Réessayez.');
  }
  return data.id;
}
