create function public.register_admin_push_token(token text, device_platform text, previous_token text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := (select auth.uid());
begin
  if owner_id is null or not exists (
    select 1 from app_private.admin_members a
    join auth.users u on u.id = a.user_id
    where a.user_id = owner_id and u.email_confirmed_at is not null
  ) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  perform public.register_push_token(token, device_platform);
  if previous_token is not null and previous_token <> token then
    delete from public.push_tokens
    where user_id = owner_id and expo_push_token = previous_token;
  end if;
end;
$$;
revoke all on function public.register_admin_push_token(text, text, text) from public, anon;
grant execute on function public.register_admin_push_token(text, text, text) to authenticated;

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
      when 'support_request' then p.admin_support and exists (
        select 1 from app_private.admin_members a
        join auth.users u on u.id = a.user_id and u.email_confirmed_at is not null
        where a.user_id = n.recipient_id
      )
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
