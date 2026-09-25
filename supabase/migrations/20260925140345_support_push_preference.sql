alter table public.notification_preferences
  add column admin_support boolean not null default true;
grant update (admin_support) on public.notification_preferences to authenticated;

create or replace function app_private.queue_push_for_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into app_private.push_deliveries (notification_id, token_id)
  select new.id, t.id
  from public.push_tokens t
  join public.notification_preferences p on p.user_id = t.user_id
  where t.user_id = new.recipient_id and t.enabled
    and case new.kind
      when 'new_message' then p.new_messages
      when 'request_response' then p.request_responses
      when 'professional_pending' then p.admin_professionals
      when 'support_request' then p.admin_support
      else false
    end;
  return new;
end;
$$;

create or replace function public.claim_push_delivery(delivery_id uuid)
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
      when 'support_request' then p.admin_support
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
