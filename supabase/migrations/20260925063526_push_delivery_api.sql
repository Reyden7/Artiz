-- The shared webhook credential never appears in the mobile app or API responses.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'artiz_push_webhook_secret')
where not exists (select 1 from vault.secrets where name = 'artiz_push_webhook_secret');

create function public.verify_artiz_push_webhook_secret(presented text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from vault.decrypted_secrets s
    where s.name = 'artiz_push_webhook_secret' and s.decrypted_secret = presented
  );
$$;
revoke all on function public.verify_artiz_push_webhook_secret(text) from public, anon, authenticated;
grant execute on function public.verify_artiz_push_webhook_secret(text) to service_role;

create function public.claim_push_delivery(delivery_id uuid)
returns table (id uuid, expo_push_token text, kind text, payload jsonb, actor_name text)
language plpgsql security definer set search_path = '' as $$
declare claimed app_private.push_deliveries%rowtype;
declare allowed boolean;
begin
  update app_private.push_deliveries d
    set status = 'processing', attempt_count = d.attempt_count + 1,
        next_attempt_at = now() + interval '2 minutes', updated_at = now()
    where d.id = delivery_id and d.attempt_count < 5
      and d.next_attempt_at <= now() and d.status in ('pending', 'processing')
    returning d.* into claimed;
  if claimed.id is null then return; end if;

  select t.enabled and case n.kind
      when 'new_message' then p.new_messages
      when 'request_response' then p.request_responses
      when 'professional_pending' then p.admin_professionals
      else false end
    into allowed
  from public.push_tokens t
  join public.notifications n on n.id = claimed.notification_id
  join public.notification_preferences p on p.user_id = n.recipient_id
  where t.id = claimed.token_id and t.user_id = n.recipient_id;
  if not coalesce(allowed, false) then
    update app_private.push_deliveries d set status = 'disabled', updated_at = now()
      where d.id = claimed.id;
    return;
  end if;

  return query select claimed.id, t.expo_push_token, n.kind, n.payload,
    coalesce(nullif(pp.business_name, ''), nullif(a.display_name, ''), 'Un membre')::text
    from public.notifications n
    join public.push_tokens t on t.id = claimed.token_id
    left join public.profiles a on a.id = n.actor_id
    left join public.professional_profiles pp on pp.user_id = n.actor_id
    where n.id = claimed.notification_id;
end;
$$;
revoke all on function public.claim_push_delivery(uuid) from public, anon, authenticated;
grant execute on function public.claim_push_delivery(uuid) to service_role;

create function public.finish_push_delivery(
  delivery_id uuid, result_status text, ticket_id text, error_message text
) returns void language plpgsql security definer set search_path = '' as $$
declare delivery app_private.push_deliveries%rowtype;
begin
  if result_status not in ('ticketed', 'pending', 'disabled')
    or (result_status = 'ticketed' and ticket_id is null) then
    raise exception 'Invalid push result' using errcode = '22023';
  end if;
  select * into delivery from app_private.push_deliveries d
    where d.id = delivery_id and d.status = 'processing' for update;
  if delivery.id is null then return; end if;
  if result_status = 'disabled' then
    update public.push_tokens set enabled = false, updated_at = now()
      where id = delivery.token_id;
  end if;
  update app_private.push_deliveries d set
    status = case when result_status = 'pending' and delivery.attempt_count >= 5
      then 'failed' else result_status end,
    expo_ticket_id = case when result_status = 'ticketed' then ticket_id else null end,
    ticketed_at = case when result_status = 'ticketed' then now() else null end,
    last_error = left(error_message, 500),
    next_attempt_at = case when result_status = 'pending'
      then now() + make_interval(secs => least(300, (power(2, delivery.attempt_count)::integer * 10)))
      else d.next_attempt_at end,
    updated_at = now()
    where d.id = delivery_id;
end;
$$;
revoke all on function public.finish_push_delivery(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.finish_push_delivery(uuid, text, text, text) to service_role;

create function public.due_push_receipts()
returns table (id uuid, expo_ticket_id text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.expo_ticket_id from app_private.push_deliveries d
  where d.status = 'ticketed' and d.ticketed_at < now() - interval '15 minutes'
    and d.ticketed_at > now() - interval '24 hours'
  order by d.ticketed_at limit 100;
$$;
revoke all on function public.due_push_receipts() from public, anon, authenticated;
grant execute on function public.due_push_receipts() to service_role;

create function public.finish_push_receipt(delivery_id uuid, result_status text, error_message text)
returns void language plpgsql security definer set search_path = '' as $$
declare token_id uuid;
begin
  if result_status not in ('delivered', 'disabled', 'failed') then
    raise exception 'Invalid receipt result' using errcode = '22023';
  end if;
  update app_private.push_deliveries d set status = result_status,
    last_error = left(error_message, 500), updated_at = now()
    where d.id = delivery_id and d.status = 'ticketed'
    returning d.token_id into token_id;
  if result_status = 'disabled' and token_id is not null then
    update public.push_tokens set enabled = false, updated_at = now() where id = token_id;
  end if;
end;
$$;
revoke all on function public.finish_push_receipt(uuid, text, text) from public, anon, authenticated;
grant execute on function public.finish_push_receipt(uuid, text, text) to service_role;
