-- A device token belongs to exactly one signed-in account at a time.
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique check (expo_push_token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$'),
  platform text not null check (platform in ('android', 'ios')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id) where enabled;
alter table public.push_tokens enable row level security;
grant select, delete on public.push_tokens to authenticated;
create policy push_tokens_self_read on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_tokens_self_delete on public.push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

create function public.register_push_token(token text, device_platform text)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := (select auth.uid());
begin
  if owner_id is null or token !~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$'
    or device_platform not in ('android', 'ios') then
    raise exception 'Invalid push registration' using errcode = '22023';
  end if;
  insert into public.push_tokens (user_id, expo_push_token, platform)
  values (owner_id, token, device_platform)
  on conflict (expo_push_token) do update set
    user_id = excluded.user_id, platform = excluded.platform,
    enabled = true, updated_at = now(), last_seen_at = now();
end;
$$;
revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  new_messages boolean not null default true,
  request_responses boolean not null default true,
  admin_professionals boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.notification_preferences (user_id) select id from public.profiles;
create function app_private.default_notification_preferences()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end;
$$;
create trigger profile_notification_preferences after insert on public.profiles
  for each row execute function app_private.default_notification_preferences();
alter table public.notification_preferences enable row level security;
grant select on public.notification_preferences to authenticated;
grant update (new_messages, request_responses, admin_professionals)
  on public.notification_preferences to authenticated;
create policy notification_preferences_self_read on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_preferences_self_update on public.notification_preferences
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Only server triggers and service-role RPCs may access this delivery queue.
create table app_private.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  token_id uuid not null references public.push_tokens(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ticketed', 'delivered', 'disabled', 'failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  expo_ticket_id text,
  ticketed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, token_id)
);
create index push_deliveries_due_idx on app_private.push_deliveries (next_attempt_at)
  where status in ('pending', 'processing');
create index push_deliveries_receipts_idx on app_private.push_deliveries (ticketed_at)
  where status = 'ticketed';
alter table app_private.push_deliveries enable row level security;
revoke all on app_private.push_deliveries from public, anon, authenticated;

create function app_private.queue_push_for_notification()
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
      else false
    end;
  return new;
end;
$$;
create trigger notification_push_queue after insert on public.notifications
  for each row execute function app_private.queue_push_for_notification();

create function app_private.notify_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare linked_request uuid;
begin
  select c.request_id into linked_request from public.conversations c where c.id = new.conversation_id;
  -- The request response has already created its own notification for this first reply.
  if linked_request is not null and exists (
    select 1 from public.service_request_responses r
    where r.request_id = linked_request and r.professional_id = new.sender_id
      and r.message = new.body and r.created_at >= new.created_at - interval '1 minute'
  ) then return new; end if;
  insert into public.notifications (recipient_id, actor_id, kind, payload)
  select cm.user_id, new.sender_id, 'new_message',
    jsonb_build_object('conversation_id', new.conversation_id)
  from public.conversation_members cm
  where cm.conversation_id = new.conversation_id and cm.user_id <> new.sender_id;
  return new;
end;
$$;
create trigger message_notification after insert on public.messages
  for each row execute function app_private.notify_new_message();

create function app_private.notify_request_response()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind, payload)
  select r.customer_id, new.professional_id, 'request_response',
    jsonb_build_object('request_id', new.request_id, 'response_id', new.id)
  from public.service_requests r where r.id = new.request_id;
  return new;
end;
$$;
create trigger request_response_notification after insert on public.service_request_responses
  for each row execute function app_private.notify_request_response();

create function app_private.notify_professional_pending()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.verification_status = 'pending' then
    insert into public.notifications (recipient_id, actor_id, kind, payload)
    select a.user_id, new.user_id, 'professional_pending',
      jsonb_build_object('professional_id', new.user_id)
    from app_private.admin_members a
    join auth.users u on u.id = a.user_id and u.email_confirmed_at is not null;
  end if;
  return new;
end;
$$;
create trigger professional_pending_notification after insert on public.professional_profiles
  for each row execute function app_private.notify_professional_pending();
