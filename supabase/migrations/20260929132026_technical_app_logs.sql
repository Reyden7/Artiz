-- Beta diagnostics: authenticated writes only, administrator reads only.
create table public.app_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  level text not null check (level in ('warn', 'error')),
  message text not null check (message ~ '^[a-z0-9._-]{3,100}$'),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  error_name text check (char_length(error_name) <= 120),
  error_message text check (char_length(error_message) <= 500),
  stack_trace text check (char_length(stack_trace) <= 4000),
  correlation_id text check (correlation_id ~ '^[a-z0-9-]{1,64}$'),
  route text check (char_length(route) <= 200),
  platform text check (platform in ('android', 'ios', 'web')),
  app_version text check (char_length(app_version) <= 80),
  build_version text check (char_length(build_version) <= 80),
  created_at timestamptz not null default now()
);
create index app_logs_user_recent_idx on public.app_logs (user_id, created_at desc);
create index app_logs_recent_idx on public.app_logs (created_at desc);
alter table public.app_logs enable row level security;
revoke all on public.app_logs from public, anon, authenticated;
grant insert (user_id, level, message, context, error_name, error_message,
  stack_trace, correlation_id, route, platform, app_version, build_version)
  on public.app_logs to authenticated;
grant select on public.app_logs to authenticated;
create policy app_logs_insert_self on public.app_logs for insert to authenticated
  with check (user_id = (select auth.uid()) and user_id is not null);
create policy app_logs_admin_read on public.app_logs for select to authenticated
  using ((select public.is_artiz_admin_self()));

create function app_private.redact_app_log_text(value text)
returns text language plpgsql immutable set search_path = '' as $$
declare cleaned text := coalesce(value, '');
begin
  if value is null then return null; end if;
  cleaned := regexp_replace(cleaned,
    '(access_token|refresh_token|password|token_hash|authorization|apikey|siret)[[:space:]]*[:=][[:space:]]*[^[:space:]&;,}]+',
    '\1=[redacted]', 'gi');
  cleaned := regexp_replace(cleaned,
    'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[token]', 'g');
  cleaned := regexp_replace(cleaned,
    '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[A-Za-z]{2,}', '[email]', 'g');
  cleaned := regexp_replace(cleaned, '[0-9]{14}', '[number]', 'g');
  cleaned := regexp_replace(cleaned, '([?&][A-Za-z_]+)=([^&[:space:]]+)', '\1=[redacted]', 'g');
  cleaned := regexp_replace(cleaned, '[A-Za-z0-9_-]{40,}', '[secret]', 'g');
  return cleaned;
end;
$$;
revoke all on function app_private.redact_app_log_text(text) from public, anon, authenticated;

create function app_private.prepare_app_log()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is not null and (
    select count(*) from public.app_logs l
    where l.user_id = new.user_id and l.created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'Too many diagnostic events' using errcode = 'P0001';
  end if;
  new.context := coalesce((
    select jsonb_object_agg(key, app_private.redact_app_log_text(left(value #>> '{}', 120)))
    from jsonb_each(new.context) where key in
      ('operation', 'screen', 'bucket', 'status_code', 'error_code', 'step', 'retry', 'correlation_id')
      and jsonb_typeof(value) in ('string', 'number', 'boolean')
  ), '{}'::jsonb);
  new.error_name := left(app_private.redact_app_log_text(new.error_name), 120);
  new.error_message := left(app_private.redact_app_log_text(new.error_message), 500);
  new.stack_trace := left(app_private.redact_app_log_text(new.stack_trace), 4000);
  new.route := left(app_private.redact_app_log_text(new.route), 200);
  return new;
end;
$$;
revoke all on function app_private.prepare_app_log() from public, anon, authenticated;
create trigger app_logs_prepare before insert on public.app_logs
for each row execute function app_private.prepare_app_log();

-- A ticket captures references to the latest technical events at creation time.
create table public.support_request_logs (
  support_request_id uuid not null references public.support_requests(id) on delete cascade,
  app_log_id uuid not null references public.app_logs(id) on delete cascade,
  primary key (support_request_id, app_log_id)
);
alter table public.support_request_logs enable row level security;
revoke all on public.support_request_logs from public, anon, authenticated;
grant select on public.support_request_logs to authenticated;
create policy support_request_logs_admin_read on public.support_request_logs
  for select to authenticated using ((select public.is_artiz_admin_self()));

create function app_private.link_recent_support_logs()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.support_request_logs (support_request_id, app_log_id)
  select new.id, recent.id from (
    select l.id from public.app_logs l
    where l.user_id = new.user_id and l.created_at >= now() - interval '24 hours'
    order by l.created_at desc limit 20
  ) recent;
  return new;
end;
$$;
revoke all on function app_private.link_recent_support_logs() from public, anon, authenticated;
create trigger support_request_attach_logs after insert on public.support_requests
for each row execute function app_private.link_recent_support_logs();

create function app_private.purge_expired_app_logs()
returns void language sql security definer set search_path = '' as $$
  delete from public.app_logs where created_at < now() - interval '60 days';
$$;
revoke all on function app_private.purge_expired_app_logs() from public, anon, authenticated;
select cron.schedule('artiz-app-log-retention', '30 3 * * *',
  $$select app_private.purge_expired_app_logs();$$);
