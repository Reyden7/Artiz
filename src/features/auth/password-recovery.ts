import { supabase } from '@/services/supabase/client';

export function recoveryErrorMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : '';
  if (/network|fetch|internet/i.test(detail)) {
    return 'Connexion indisponible. Vérifiez votre accès à Internet puis réessayez.';
  }
  if (/expir|invalid|already|used|otp|token|code verifier|invalide/i.test(detail)) {
    return 'Ce lien de réinitialisation est invalide, expiré ou déjà utilisé. Demandez un nouveau lien.';
  }
  return 'La réinitialisation a échoué. Réessayez ou demandez un nouveau lien.';
}

export async function openRecoverySession(values: URLSearchParams) {
  if (!supabase) throw new Error('Service indisponible.');
  if (values.has('error')) {
    throw new Error(values.get('error_description')?.replace(/\+/g, ' ') || values.get('error_code') || 'Lien invalide.');
  }
  const linkType = values.get('type');
  if (linkType && linkType !== 'recovery') throw new Error('Lien invalide.');

  const code = values.get('code');
  const accessToken = values.get('access_token');
  const refreshToken = values.get('refresh_token');
  const tokenHash = values.get('token_hash');
  if (!code && !accessToken && !refreshToken && !tokenHash) throw new Error('Lien invalide.');

  if (code) {
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    if (!data.session) throw new Error('Lien invalide.');
  } else if (accessToken || refreshToken) {
    if (!accessToken || !refreshToken) throw new Error('Lien invalide.');
    const { error, data } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    if (!data.session) throw new Error('Lien invalide.');
  } else if (tokenHash) {
    const { error, data } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (error) throw error;
    if (!data.session) throw new Error('Lien invalide.');
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw error || new Error('Session invalide.');
}
