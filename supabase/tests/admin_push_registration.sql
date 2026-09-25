-- Direct RPC/RLS test. The transaction rolls back all fixture users and tokens.
begin;
insert into auth.users (id, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000961', now()),
  ('00000000-0000-4000-8000-000000000962', now()),
  ('00000000-0000-4000-8000-000000000963', null);
insert into app_private.admin_members (user_id)
values ('00000000-0000-4000-8000-000000000962'),
  ('00000000-0000-4000-8000-000000000963');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000961', true);
do $$ declare accepted boolean := false; begin
  begin
    perform public.register_admin_push_token('ExpoPushToken[fixture-a]', 'android', null);
    accepted := true;
  exception when insufficient_privilege then null; end;
  if accepted then raise exception 'Customer registered as administrator'; end if;
end $$;
select public.register_push_token('ExpoPushToken[fixture-a]', 'android');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000963', true);
do $$ declare accepted boolean := false; begin
  begin
    perform public.register_admin_push_token('ExpoPushToken[fixture-unconfirmed]', 'android', null);
    accepted := true;
  exception when insufficient_privilege then null; end;
  if accepted then raise exception 'Unconfirmed admin registered a token'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000962', true);
select public.register_admin_push_token('ExpoPushToken[fixture-a]', 'android', null);
do $$ begin
  if (select count(*) from public.push_tokens where expo_push_token = 'ExpoPushToken[fixture-a]') <> 1 then
    raise exception 'Admin could not take ownership of device token';
  end if;
end $$;
select public.register_admin_push_token('ExpoPushToken[fixture-b]', 'android', 'ExpoPushToken[fixture-a]');
do $$ begin
  if (select count(*) from public.push_tokens) <> 1
    or not exists (select 1 from public.push_tokens where expo_push_token = 'ExpoPushToken[fixture-b]') then
    raise exception 'Renewal left an active old token';
  end if;
end $$;
delete from public.push_tokens where expo_push_token = 'ExpoPushToken[fixture-b]';
do $$ begin
  if exists (select 1 from public.push_tokens) then raise exception 'Logout did not revoke token'; end if;
end $$;
select public.register_admin_push_token('ExpoPushToken[fixture-b]', 'android', null);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000961', true);
select public.register_push_token('ExpoPushToken[fixture-b]', 'android');
do $$ begin
  if (select count(*) from public.push_tokens where expo_push_token = 'ExpoPushToken[fixture-b]') <> 1 then
    raise exception 'New account did not take ownership of the device token';
  end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000962', true);
do $$ begin
  if exists (select 1 from public.push_tokens) then
    raise exception 'Previous admin still owns the switched device token';
  end if;
end $$;
rollback;
