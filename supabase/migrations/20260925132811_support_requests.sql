-- Support reports are private to their author and confirmed Artiz administrators.
create function public.is_artiz_admin_self()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app_private.admin_members a
    join auth.users u on u.id = a.user_id
    where a.user_id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_artiz_admin_self() from public, anon;
grant execute on function public.is_artiz_admin_self() to authenticated;

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  category text not null check (category in (
    'login', 'account', 'post', 'messaging', 'professional', 'bug', 'suggestion', 'other')),
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  description text not null check (char_length(btrim(description)) between 10 and 4000),
  contact_email text not null check (char_length(btrim(contact_email)) between 3 and 254),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  platform text not null check (platform in ('android', 'ios', 'web')),
  app_version text not null check (char_length(app_version) between 1 and 80),
  device_info text check (char_length(device_info) <= 500),
  screen_path text check (char_length(screen_path) <= 300),
  screenshot_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (screenshot_path is null or (
    split_part(screenshot_path, '/', 1) = user_id::text and
    screenshot_path ~ ('^' || user_id::text || '/[0-9a-z-]+\.jpg$')))
);
create index support_requests_user_recent_idx on public.support_requests (user_id, created_at desc);
create index support_requests_admin_open_idx on public.support_requests (created_at desc)
  where status in ('open', 'in_progress');
alter table public.support_requests enable row level security;
revoke all on public.support_requests from public, anon, authenticated;
grant select on public.support_requests to authenticated;
grant insert (id, user_id, category, subject, description, contact_email, platform,
  app_version, device_info, screen_path, screenshot_path) on public.support_requests to authenticated;
grant update (status, priority) on public.support_requests to authenticated;
create policy support_requests_select on public.support_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_artiz_admin_self()));
create policy support_requests_insert on public.support_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and priority = 'normal');
create policy support_requests_admin_update on public.support_requests for update to authenticated
  using ((select public.is_artiz_admin_self()))
  with check ((select public.is_artiz_admin_self()));

create function app_private.touch_support_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger support_request_updated before update on public.support_requests
  for each row execute function app_private.touch_support_request();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-screenshots', 'support-screenshots', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;
create policy support_screenshots_read on storage.objects for select to authenticated
  using (bucket_id = 'support-screenshots' and
    (split_part(name, '/', 1) = (select auth.uid())::text or (select public.is_artiz_admin_self())));
create policy support_screenshots_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'support-screenshots' and
    split_part(name, '/', 1) = (select auth.uid())::text and
    name ~ ('^' || (select auth.uid())::text || '/[0-9a-z-]+\.jpg$'));
create policy support_screenshots_delete on storage.objects for delete to authenticated
  using (bucket_id = 'support-screenshots' and split_part(name, '/', 1) = (select auth.uid())::text);

create function app_private.notify_support_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind, payload)
  select a.user_id, new.user_id, 'support_request',
    jsonb_build_object('support_request_id', new.id)
  from app_private.admin_members a
  join auth.users u on u.id = a.user_id and u.email_confirmed_at is not null;
  return new;
end;
$$;
create trigger support_request_notification after insert on public.support_requests
  for each row execute function app_private.notify_support_request();

-- Reuse the existing admin push preference and delivery queue.
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
      when 'support_request' then p.admin_professionals
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
      when 'support_request' then p.admin_professionals
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
