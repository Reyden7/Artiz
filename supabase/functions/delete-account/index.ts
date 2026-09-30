import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.117.1';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const buckets = ['avatars', 'covers', 'post-images', 'request-images', 'support-screenshots'] as const;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

type AdminClient = ReturnType<typeof createClient>;

async function removeUserFiles(client: AdminClient, bucket: string, userId: string) {
  const storage = client.storage.from(bucket);
  const files: string[] = [];
  const pending = [userId];
  while (pending.length) {
    const prefix = pending.pop()!;
    let offset = 0;
    while (true) {
      const { data, error } = await storage.list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw error;
      for (const entry of data ?? []) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id) files.push(path);
        else pending.push(path);
      }
      if (!data || data.length < 100) break;
      offset += data.length;
    }
  }
  for (let start = 0; start < files.length; start += 100) {
    const { error } = await storage.remove(files.slice(start, start + 100));
    if (error) throw error;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  if (Number(request.headers.get('content-length') ?? '0') > 1024) {
    return json(413, { error: 'Requête trop volumineuse.' });
  }
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) return json(401, { error: 'Connexion requise.' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serverKey) return json(503, { error: 'Service indisponible.' });

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(bearer.slice(7));
  if (authError || !user || user.is_anonymous) return json(401, { error: 'Connexion requise.' });

  let body: unknown;
  try { body = await request.json(); }
  catch { return json(400, { error: 'Confirmation invalide.' }); }
  // This function deliberately accepts no account ID: the target is always
  // the authenticated subject. A distinct consent phrase prevents accidental calls.
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || (body as Record<string, unknown>).confirmation !== 'SUPPRIMER') {
    return json(400, { error: 'Confirmation invalide.' });
  }

  const admin = createClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    for (const bucket of buckets) await removeUserFiles(admin, bucket, user.id);
  } catch (error) {
    console.error('Account deletion: Storage cleanup failed', { userId: user.id, error });
    return json(503, { error: 'Impossible de supprimer les fichiers du compte. Réessayez.' });
  }

  const { error: deletionError } = await admin.auth.admin.deleteUser(user.id);
  if (deletionError) {
    console.error('Account deletion: Auth deletion failed', { userId: user.id, error: deletionError });
    return json(503, { error: 'Impossible de supprimer le compte. Réessayez.' });
  }
  return json(200, { deleted: true });
});
