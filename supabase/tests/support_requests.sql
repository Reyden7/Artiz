-- Run with the SQL editor or psql. Every fixture is rolled back.
begin;
insert into auth.users (id, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000951', now()),
  ('00000000-0000-4000-8000-000000000952', now()),
  ('00000000-0000-4000-8000-000000000953', now());
insert into app_private.admin_members (user_id) values ('00000000-0000-4000-8000-000000000953');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000951', true);
insert into storage.objects (bucket_id, name) values
  ('support-screenshots', '00000000-0000-4000-8000-000000000951/first.jpg');
insert into public.support_requests
  (id, user_id, category, subject, description, contact_email, platform, app_version, screenshot_path)
values
  ('00000000-0000-4000-8000-000000000954', '00000000-0000-4000-8000-000000000951',
   'bug', 'Premier problème', 'Description de la première demande.', 'test@example.org',
   'android', '1.0.0-test', '00000000-0000-4000-8000-000000000951/first.jpg');
do $$ declare succeeded boolean := false; affected integer; begin
  begin
    insert into public.support_requests (user_id, category, subject, description, contact_email, platform, app_version)
    values ('00000000-0000-4000-8000-000000000952', 'bug', 'Usurpation',
      'Une demande pour un autre compte.', 'test@example.org', 'android', '1.0.0-test');
    succeeded := true;
  exception when others then null; end;
  if succeeded then raise exception 'Another user request was accepted'; end if;
  update public.support_requests set status = 'closed'
    where id = '00000000-0000-4000-8000-000000000954';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Customer changed support status'; end if;
  update public.support_requests set subject = 'Sujet falsifié'
    where id = '00000000-0000-4000-8000-000000000954';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Customer edited a support request'; end if;
  delete from public.support_requests
    where id = '00000000-0000-4000-8000-000000000954';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Customer deleted a support request'; end if;
  succeeded := false;
  begin
    insert into storage.objects (bucket_id, name) values
      ('support-screenshots', '00000000-0000-4000-8000-000000000952/forbidden.jpg');
    succeeded := true;
  exception when others then null; end;
  if succeeded then raise exception 'Customer uploaded to another user folder'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000952', true);
insert into public.support_requests
  (id, user_id, category, subject, description, contact_email, platform, app_version)
values
  ('00000000-0000-4000-8000-000000000955', '00000000-0000-4000-8000-000000000952',
   'account', 'Second problème', 'Description de la seconde demande.', 'test@example.org',
   'ios', '1.0.0-test');
do $$ begin
  if (select count(*) from public.support_requests where id in
      ('00000000-0000-4000-8000-000000000954', '00000000-0000-4000-8000-000000000955')) <> 1
    or exists (select 1 from storage.objects where bucket_id = 'support-screenshots') then
    raise exception 'Customer can read another request or screenshot';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000953', true);
do $$ begin
  if not public.is_artiz_admin_self()
    or (select count(*) from public.support_requests where id in
      ('00000000-0000-4000-8000-000000000954', '00000000-0000-4000-8000-000000000955')) <> 2
    or not exists (select 1 from storage.objects where bucket_id = 'support-screenshots')
    or (select count(*) from public.notifications where recipient_id =
      '00000000-0000-4000-8000-000000000953' and kind = 'support_request') <> 2 then
    raise exception 'Admin cannot read requests, screenshot, or notifications';
  end if;
end $$;
update public.support_requests set status = 'in_progress'
  where id = '00000000-0000-4000-8000-000000000954';
update public.support_requests set category = 'other', subject = 'Sujet corrigé',
  description = 'Description corrigée par le support.', contact_email = 'new@example.org',
  priority = 'high'
  where id = '00000000-0000-4000-8000-000000000954';
do $$ begin
  if (select status from public.support_requests where id =
      '00000000-0000-4000-8000-000000000954') <> 'in_progress'
    or (select subject from public.support_requests where id =
      '00000000-0000-4000-8000-000000000954') <> 'Sujet corrigé'
    or (select priority from public.support_requests where id =
      '00000000-0000-4000-8000-000000000954') <> 'high' then
    raise exception 'Admin could not edit the request';
  end if;
end $$;
-- Storage objects must be deleted through the Storage API, never with SQL.
-- The admin Storage RLS policy is checked separately from this rolled-back fixture.
delete from public.support_requests where id = '00000000-0000-4000-8000-000000000954';
do $$ begin
  if exists (select 1 from public.support_requests where id =
      '00000000-0000-4000-8000-000000000954')
    or exists (select 1 from public.notifications where kind = 'support_request'
      and payload->>'support_request_id' = '00000000-0000-4000-8000-000000000954') then
    raise exception 'Admin deletion did not remove the request and its alerts';
  end if;
end $$;
rollback;
