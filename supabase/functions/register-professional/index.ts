import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import { lookupSiret } from '../_shared/registry.ts';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  if (Number(request.headers.get('content-length') ?? '0') > 4096) {
    return json(413, { error: 'Requête trop volumineuse.' });
  }
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) return json(401, { error: 'Connexion requise.' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serverKey) {
    return json(503, { error: 'Inscription temporairement indisponible.' });
  }
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(bearer.slice(7));
  if (authError || !user) return json(401, { error: 'Connexion requise.' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Données invalides.' });
  }
  if (!body || typeof body !== 'object') return json(400, { error: 'Données invalides.' });
  const input = body as Record<string, unknown>;
  const businessName = typeof input.businessName === 'string' ? input.businessName.trim() : '';
  const siret = typeof input.siret === 'string' ? input.siret.trim() : '';
  if (businessName.length < 2 || businessName.length > 150 || !/^\d{14}$/.test(siret)) {
    return json(400, { error: 'Nom commercial ou SIRET invalide.' });
  }

  const server = createClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await server
    .from('profiles').select('account_type').eq('id', user.id).maybeSingle();
  if (profileError || !profile) return json(403, { error: 'Compte introuvable.' });
  if (profile.account_type !== 'customer') {
    return json(409, { error: 'Une inscription professionnelle existe déjà.' });
  }
  const { data: allowed, error: limitError } = await server
    .rpc('record_professional_registration_attempt', { subject_id: user.id });
  if (limitError) return json(503, { error: 'Inscription temporairement indisponible.' });
  if (!allowed) return json(429, { error: 'Trop de tentatives. Réessayez dans une heure.' });

  let registry;
  try {
    registry = await lookupSiret(siret);
  } catch {
    return json(503, { error: 'Le registre des entreprises est indisponible. Réessayez plus tard.' });
  }
  if (!registry) {
    return json(422, { error: 'Ce SIRET ne correspond pas à un établissement actif.' });
  }

  const { error } = await server.rpc('complete_professional_registration', {
    subject_id: user.id,
    submitted_siret: siret,
    submitted_business_name: businessName,
    registry_legal_name: registry.legalName,
  });
  if (error?.code === '23505' || error?.code === '23514') {
    return json(409, { error: 'Cette inscription professionnelle existe déjà.' });
  }
  if (error) return json(503, { error: 'Inscription temporairement indisponible.' });
  await server.rpc('save_professional_registry_snapshot', {
    subject_id: user.id,
    submitted_siret: siret,
    commune: registry.commune,
    postal_code: registry.postalCode,
    snapshot: registry.snapshot,
  });
  return json(200, { account_type: 'professional', verification_status: 'pending', plan: 'FREE' });
});
