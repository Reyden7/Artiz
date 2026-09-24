-- Direct SQL regression for the privileged registration transaction.
begin;
insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000601'),
  ('00000000-0000-4000-8000-000000000602');
insert into auth.users (id, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000603',
        '{"account_type":"professional","verification_status":"verified"}'::jsonb);
do $$ begin
  if not exists (select 1 from public.profiles
    where id = '00000000-0000-4000-8000-000000000603'
      and account_type = 'customer') then
    raise exception 'user metadata granted professional rights';
  end if;
end; $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000601', true);
do $$ begin
  begin
    perform public.complete_professional_registration(
      '00000000-0000-4000-8000-000000000601',
      '55204944776279', 'Atelier Test', 'SNCF');
    raise exception 'client called privileged enrollment';
  exception when insufficient_privilege then null;
  end;
end; $$;

reset role;
select public.complete_professional_registration(
  '00000000-0000-4000-8000-000000000601',
  '55204944776279', 'Atelier Test', 'SNCF');
do $$ begin
  if not exists (select 1 from public.profiles
    where id = '00000000-0000-4000-8000-000000000601'
      and account_type = 'professional') then
    raise exception 'professional account type missing';
  end if;
  if not exists (select 1 from public.professional_profiles
    where user_id = '00000000-0000-4000-8000-000000000601'
      and verification_status = 'pending') then
    raise exception 'pending professional profile missing';
  end if;
  if not exists (select 1 from app_private.professional_verifications
    where user_id = '00000000-0000-4000-8000-000000000601'
      and siret = '55204944776279' and checked_at is not null) then
    raise exception 'private SIRET record missing';
  end if;
  if not exists (select 1 from public.subscriptions
    where professional_id = '00000000-0000-4000-8000-000000000601'
      and plan = 'FREE' and status = 'active') then
    raise exception 'initial FREE subscription missing';
  end if;
  begin
    perform public.complete_professional_registration(
      '00000000-0000-4000-8000-000000000602',
      '55204944776279', 'Atelier Bis', 'SNCF');
    raise exception 'duplicate SIRET was accepted';
  exception when unique_violation then null;
  end;
  if not exists (select 1 from public.profiles
    where id = '00000000-0000-4000-8000-000000000602'
      and account_type = 'customer') then
    raise exception 'failed enrollment did not roll back account type';
  end if;
end; $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000601', true);
do $$ begin
  if (select count(*) from public.professional_profiles where user_id =
      '00000000-0000-4000-8000-000000000601') <> 1 then
    raise exception 'owner cannot read pending status';
  end if;
  begin
    insert into public.posts (author_id, title, body)
      values ('00000000-0000-4000-8000-000000000601', 'Premature', 'Premature');
    raise exception 'pending account published';
  exception when insufficient_privilege then null;
  end;
end; $$;
rollback;
