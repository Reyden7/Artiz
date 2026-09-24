import AsyncStorage from '@react-native-async-storage/async-storage';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase/client';

const key = 'artiz.pending-professional-registration';

export type PendingProfessionalRegistration = {
  email: string;
  businessName: string;
  siret: string;
};

export async function savePendingProfessionalRegistration(value: PendingProfessionalRegistration) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getPendingProfessionalRegistration(email?: string | null) {
  if (!email) return null;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PendingProfessionalRegistration;
    return value.email.toLowerCase() === email.trim().toLowerCase() ? value : null;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function completeProfessionalRegistration(value: PendingProfessionalRegistration) {
  if (!supabase) throw new Error('Supabase est indisponible.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.email?.toLowerCase() !== value.email.toLowerCase()) {
    throw new Error('Connectez-vous avec l’adresse e-mail utilisée pour l’inscription.');
  }
  const { error } = await supabase.functions.invoke('register-professional', {
    body: { businessName: value.businessName, siret: value.siret },
  });
  if (error) {
    // The server may have committed the transaction before the response was lost.
    const { data: profile } = await supabase.from('professional_profiles')
      .select('verification_status').eq('user_id', user.id).maybeSingle();
    if (profile) {
      await AsyncStorage.removeItem(key);
      return;
    }
    if (error instanceof FunctionsHttpError) {
      const response = error.context;
      const payload = await response.json().catch(() => null);
      if (payload && typeof payload.error === 'string') throw new Error(payload.error);
    }
    throw new Error('La vérification du SIRET a échoué. Réessayez plus tard.');
  }
  await AsyncStorage.removeItem(key);
}

export async function completePendingProfessionalRegistration(email?: string | null) {
  const pending = await getPendingProfessionalRegistration(email);
  if (!pending) return false;
  await completeProfessionalRegistration(pending);
  return true;
}
