import { supabase } from '@/services/supabase/client';

export type ConfirmationResult =
  | { status: 'signed-in'; email: string | undefined }
  | { status: 'confirmed-without-session' };

export function confirmationErrorMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : '';
  if (/expir|invalid.*(link|token|jwt)|invalide|jwt structure/i.test(detail)) {
    return 'Ce lien de confirmation est invalide ou a expiré. Demandez un nouveau lien ou connectez-vous si votre adresse est déjà confirmée.';
  }
  if (/code verifier/i.test(detail)) {
    return 'La confirmation n’a pas pu ouvrir une session sur cet appareil. Si votre adresse est confirmée, connectez-vous avec votre mot de passe.';
  }
  if (/network|fetch/i.test(detail)) {
    return 'Connexion indisponible. Vérifiez votre accès à Internet puis réessayez.';
  }
  return 'La confirmation n’a pas pu être finalisée. Réessayez avec un nouveau lien ou connectez-vous si votre adresse est déjà confirmée.';
}

export async function confirmEmailFromParameters(values: URLSearchParams): Promise<ConfirmationResult> {
  if (!supabase) throw new Error('Supabase est indisponible.');
  if (values.has('error')) {
    if (values.get('error_code') === 'otp_expired') {
      throw new Error('Ce lien a expiré ou a déjà été utilisé. Demandez un nouvel e-mail de confirmation.');
    }
    throw new Error(values.get('error_description')?.replace(/\+/g, ' ') || 'La confirmation a échoué.');
  }

  const code = values.get('code');
  const accessToken = values.get('access_token');
  const refreshToken = values.get('refresh_token');
  const tokenHash = values.get('token_hash');
  let createdSession = false;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    createdSession = Boolean(data.session);
  } else if (accessToken || refreshToken) {
    if (!accessToken || !refreshToken) throw new Error('Le lien de confirmation est incomplet.');
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken, refresh_token: refreshToken,
    });
    if (error) throw error;
    createdSession = Boolean(data.session);
  } else if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: values.get('type') || 'signup',
    });
    if (error) throw error;
    createdSession = Boolean(data.session);
  } else {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) return { status: 'confirmed-without-session' };
    createdSession = true;
  }

  if (!createdSession) return { status: 'confirmed-without-session' };
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('La session n’a pas pu être vérifiée.');
  return { status: 'signed-in', email: user.email };
}
