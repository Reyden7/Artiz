import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import { lookupSiret } from '../_shared/registry.ts';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'GET' && request.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  if (Number(request.headers.get('content-length') ?? '0') > 4096) {
    return json(413, { error: 'Requête trop volumineuse.' });
  }
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) return json(401, { error: 'Connexion requise.' });
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serverKey) return json(503, { error: 'Administration indisponible.' });

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(bearer.slice(7));
  if (authError || !user) return json(401, { error: 'Connexion requise.' });
  const server = createClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isAdmin, error: adminError } = await server.rpc('is_artiz_admin', { subject_id: user.id });
  if (adminError) return json(503, { error: 'Administration indisponible.' });
  if (!isAdmin) return json(403, { error: 'Accès administrateur requis.' });

  if (request.method === 'GET') {
    const { data, error } = await server.rpc('pending_professional_reviews', { admin_id: user.id });
    if (error) return json(503, { error: 'Impossible de charger les demandes.' });
    const pending = data ?? [];
    // Older applications may predate registry snapshots. Refresh those server-side.
    for (const item of pending) {
      if (item.registry_data && Object.keys(item.registry_data).length > 0) continue;
      try {
        const registry = await lookupSiret(item.siret);
        if (!registry) continue;
        const { error: snapshotError } = await server.rpc('save_professional_registry_snapshot', {
          subject_id: item.user_id,
          submitted_siret: item.siret,
          commune: registry.commune,
          postal_code: registry.postalCode,
          snapshot: registry.snapshot,
        });
        if (!snapshotError) {
          item.commune = registry.commune;
          item.postal_code = registry.postalCode;
          item.registry_data = registry.snapshot;
        }
      } catch {
        // The application remains reviewable even when the public registry is down.
      }
    }
    return json(200, { pending });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { error: 'Données invalides.' }); }
  if (!body || typeof body !== 'object') return json(400, { error: 'Données invalides.' });
  const input = body as Record<string, unknown>;
  const professionalId = typeof input.professionalId === 'string' ? input.professionalId : '';
  const decision = typeof input.decision === 'string' ? input.decision : '';
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(professionalId)
    || !['verified', 'rejected'].includes(decision)
    || note.length > 1000) {
    return json(400, { error: 'Décision invalide.' });
  }
  if (decision === 'verified') {
    const { data: application, error: applicationError } = await server.rpc('pending_professional_reviews', { admin_id: user.id });
    if (applicationError) return json(503, { error: 'Impossible de charger la demande.' });
    const pendingItem = application?.find((item: { user_id: string }) => item.user_id === professionalId);
    if (!pendingItem) return json(409, { error: 'Cette demande a déjà été traitée.' });
    let registry;
    try { registry = await lookupSiret(pendingItem.siret); }
    catch { return json(503, { error: 'Le registre officiel est indisponible. Réessayez plus tard.' }); }
    if (!registry) return json(409, { error: 'Ce SIRET ne correspond plus à un établissement actif.' });
    const { error: snapshotError } = await server.rpc('save_professional_registry_snapshot', {
      subject_id: professionalId,
      submitted_siret: pendingItem.siret,
      commune: registry.commune,
      postal_code: registry.postalCode,
      snapshot: registry.snapshot,
    });
    if (snapshotError) return json(503, { error: 'Le contrôle du registre n’a pas pu être enregistré.' });
  }
  const { error } = await server.rpc('review_professional_affiliation', {
    subject_id: professionalId,
    reviewer_id: user.id,
    decision,
    affiliation_evidence: '',
    note,
  });
  if (error?.code === '23514') return json(409, { error: 'Cette demande a déjà été traitée.' });
  if (error?.code === '22023') return json(409, { error: 'Le SIRET doit être actif dans le registre officiel pour valider.' });
  if (error) return json(503, { error: 'Décision non enregistrée.' });
  return json(200, { verification_status: decision });
});
