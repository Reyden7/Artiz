import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.117.1';

const jsonHeaders = { 'Content-Type': 'application/json' };
const sendUrl = 'https://exp.host/--/api/v2/push/send';
const receiptsUrl = 'https://exp.host/--/api/v2/push/getReceipts';

function reply(status: number, data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

type Delivery = {
  id: string;
  expo_push_token: string;
  kind: string;
  payload: Record<string, unknown>;
  actor_name: string;
};

function content(delivery: Delivery) {
  const name = delivery.actor_name || 'Un membre';
  if (delivery.kind === 'professional_pending') {
    return { title: 'Nouveau professionnel à valider', body: `${name} attend votre validation.`, url: '/admin/professionals' };
  }
  if (delivery.kind === 'request_response') {
    return { title: 'Un professionnel a répondu à votre demande', body: `${name} est intéressé par votre projet.`, url: '/requests' };
  }
  const conversationId = delivery.payload.conversation_id;
  return {
    title: 'Nouveau message', body: `${name} vous a envoyé un message.`,
    url: typeof conversationId === 'string' ? `/conversation/${conversationId}` : '/messages',
  };
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return reply(503, { error: 'Server unavailable' });
  const bearer = request.headers.get('authorization')?.replace(/^Bearer /i, '') ?? '';
  if (!bearer) return reply(401, { error: 'Unauthorized' });
  const server = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authorized, error: authError } = await server.rpc('verify_artiz_push_webhook_secret', { presented: bearer });
  if (authError || !authorized) return reply(401, { error: 'Unauthorized' });

  let input: Record<string, unknown>;
  try { input = await request.json(); }
  catch { return reply(400, { error: 'Invalid JSON' }); }

  if (input.mode === 'receipts') {
    const { data: due, error } = await server.rpc('due_push_receipts');
    if (error) return reply(503, { error: 'Receipt lookup failed' });
    if (!due?.length) return reply(200, { checked: 0 });
    const ids = due.map((item: { expo_ticket_id: string }) => item.expo_ticket_id);
    const response = await fetch(receiptsUrl, {
      method: 'POST', headers: jsonHeaders, body: JSON.stringify({ ids }), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return reply(503, { error: 'Expo receipts unavailable' });
    const result = await response.json() as { data?: Record<string, { status: string; details?: { error?: string }; message?: string }> };
    let checked = 0;
    for (const item of due as { id: string; expo_ticket_id: string }[]) {
      const receipt = result.data?.[item.expo_ticket_id];
      if (!receipt) continue;
      const status = receipt.status === 'ok' ? 'delivered'
        : receipt.details?.error === 'DeviceNotRegistered' ? 'disabled' : 'failed';
      await server.rpc('finish_push_receipt', {
        delivery_id: item.id, result_status: status,
        error_message: receipt.message ?? receipt.details?.error ?? null,
      });
      checked++;
    }
    return reply(200, { checked });
  }

  const deliveryId = input.delivery_id;
  if (typeof deliveryId !== 'string' || !/^[0-9a-f-]{36}$/i.test(deliveryId)) {
    return reply(400, { error: 'Invalid delivery' });
  }
  const { data, error } = await server.rpc('claim_push_delivery', { delivery_id: deliveryId });
  if (error) return reply(503, { error: 'Delivery unavailable' });
  const delivery = (data as Delivery[] | null)?.[0];
  if (!delivery) return reply(200, { skipped: true });

  try {
    const message = content(delivery);
    const response = await fetch(sendUrl, {
      method: 'POST', headers: jsonHeaders,
      body: JSON.stringify({ to: delivery.expo_push_token, title: message.title,
        body: message.body, data: { url: message.url }, channelId: 'artiz-updates' }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Expo HTTP ${response.status}`);
    const result = await response.json() as {
      data?: { status: string; id?: string; message?: string; details?: { error?: string } };
    };
    const ticket = result.data;
    const status = ticket?.status === 'ok' && ticket.id ? 'ticketed'
      : ticket?.details?.error === 'DeviceNotRegistered' ? 'disabled' : 'pending';
    await server.rpc('finish_push_delivery', {
      delivery_id: delivery.id, result_status: status,
      ticket_id: ticket?.id ?? null,
      error_message: ticket?.message ?? ticket?.details?.error ?? null,
    });
    return reply(200, { status });
  } catch (error) {
    await server.rpc('finish_push_delivery', {
      delivery_id: delivery.id, result_status: 'pending', ticket_id: null,
      error_message: error instanceof Error ? error.message : 'Push failed',
    });
    return reply(503, { error: 'Push failed' });
  }
});
