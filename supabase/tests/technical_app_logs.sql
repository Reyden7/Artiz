-- Owner-run security test; all fixtures and the disabled notification trigger roll back.
begin;
alter table public.support_requests disable trigger support_request_notification;

insert into auth.users (id, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000971', now()),
  ('00000000-0000-4000-8000-000000000972', now()),
  ('00000000-0000-4000-8000-000000000973', now());
insert into app_private.admin_members (user_id)
values ('00000000-0000-4000-8000-000000000973');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000971', true);
insert into public.app_logs
  (user_id, level, message, context, error_name, error_message, stack_trace, platform)
values
  (auth.uid(), 'error', 'test.deliberate_failure',
   '{"operation":"test","password":"private-value","status_code":500}',
   'TestError', 'Failed for beta@example.com SIRET 98119208100033',
   'Bearer access_token=secret-value', 'android');
do $$
declare succeeded boolean := false;
begin
  if exists (select 1 from public.app_logs where message = 'test.deliberate_failure') then
    raise exception 'Ordinary user can read app logs';
  end if;
  begin
    insert into public.app_logs (user_id, level, message)
    values ('00000000-0000-4000-8000-000000000972', 'warn', 'test.spoofed');
    succeeded := true;
  exception when insufficient_privilege then null;
  end;
  if succeeded then raise exception 'User spoofed another user_id'; end if;
end;
$$;

insert into public.support_requests
  (id, user_id, category, subject, description, contact_email, platform, app_version)
values
  ('00000000-0000-4000-8000-000000000974', auth.uid(), 'bug',
   'Problème test', 'Demande liée au journal technique.', 'test@example.org',
   'android', '1.0.0-test');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000972', true);
do $$
begin
  if exists (select 1 from public.app_logs) or exists (select 1 from public.support_request_logs) then
    raise exception 'Another user can read technical logs';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000973', true);
do $$
declare item public.app_logs%rowtype;
begin
  select * into item from public.app_logs where message = 'test.deliberate_failure';
  if item.id is null then raise exception 'Admin cannot read app logs'; end if;
  if item.context ? 'password' or item.error_message like '%beta@example.com%'
    or item.error_message like '%98119208100033%'
    or item.stack_trace like '%secret-value%' then
    raise exception 'Sensitive data was stored in a diagnostic event';
  end if;
  if not exists (select 1 from public.support_request_logs
      where support_request_id = '00000000-0000-4000-8000-000000000974'
        and app_log_id = item.id) then
    raise exception 'Recent log was not linked to support request';
  end if;
end;
$$;

select 'technical_app_logs_passed' as result;
rollback;
