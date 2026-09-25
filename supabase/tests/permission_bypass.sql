-- Run as a database owner. Simulates direct Data API writes as authenticated
-- users; every fixture and attempted write is rolled back.
begin;
insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000501'), -- customer A
  ('00000000-0000-4000-8000-000000000502'), -- customer B
  ('00000000-0000-4000-8000-000000000503'), -- verified professional
  ('00000000-0000-4000-8000-000000000504'), -- pending professional
  ('00000000-0000-4000-8000-000000000505'), -- verified professional
  ('00000000-0000-4000-8000-000000000508'); -- stale verified profile, customer role
update public.profiles set account_type = 'professional'
where id in ('00000000-0000-4000-8000-000000000503',
             '00000000-0000-4000-8000-000000000504',
             '00000000-0000-4000-8000-000000000505',
             '00000000-0000-4000-8000-000000000508');
insert into public.professional_profiles (user_id, business_name, verification_status) values
  ('00000000-0000-4000-8000-000000000503', 'Atelier vérifié', 'verified'),
  ('00000000-0000-4000-8000-000000000504', 'Atelier en attente', 'pending'),
  ('00000000-0000-4000-8000-000000000505', 'Atelier vérifié B', 'verified'),
  ('00000000-0000-4000-8000-000000000508', 'Atelier ancien', 'verified');
insert into public.professional_services (professional_id, title)
values ('00000000-0000-4000-8000-000000000508', 'Ancien service');
insert into public.posts (author_id, title, body)
values ('00000000-0000-4000-8000-000000000508', 'Ancienne réalisation', 'Ancienne réalisation');
update public.profiles set account_type = 'customer'
where id = '00000000-0000-4000-8000-000000000508';
insert into public.service_requests (id, customer_id, title, description, city)
values ('00000000-0000-4000-8000-000000000506',
        '00000000-0000-4000-8000-000000000502',
        'Travaux de maison', 'Je cherche un artisan local', 'Annecy');
insert into public.service_requests
  (id, customer_id, recipient_id, visibility, title, description, city)
values ('00000000-0000-4000-8000-000000000507',
        '00000000-0000-4000-8000-000000000502',
        '00000000-0000-4000-8000-000000000505', 'private',
        'Travaux privés', 'Demande réservée au pro B', 'Annecy');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000501', true);
do $$
begin
  if (select count(*) from public.professional_profiles
      where user_id in ('00000000-0000-4000-8000-000000000503',
                        '00000000-0000-4000-8000-000000000504',
                        '00000000-0000-4000-8000-000000000505',
                        '00000000-0000-4000-8000-000000000508')) <> 2 then
    raise exception 'professional directory contains an unverified profile';
  end if;
  if (select count(*) from public.professional_profiles
      where verification_status = 'verified'
        and user_id in ('00000000-0000-4000-8000-000000000503',
                        '00000000-0000-4000-8000-000000000504',
                        '00000000-0000-4000-8000-000000000505',
                        '00000000-0000-4000-8000-000000000508')) <> 2 then
    raise exception 'professional directory includes an unverified profile';
  end if;
  if (select count(*) from public.professional_services
      where professional_id = '00000000-0000-4000-8000-000000000508') <> 0
    or (select count(*) from public.posts
      where author_id = '00000000-0000-4000-8000-000000000508') <> 0 then
    raise exception 'former professional remained in search or feed';
  end if;
  begin
    update public.profiles set account_type = 'professional'
      where id = '00000000-0000-4000-8000-000000000501';
    raise exception 'client changed its account type';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.professional_profiles (user_id, business_name)
      values ('00000000-0000-4000-8000-000000000501', 'Fake pro');
    raise exception 'customer created professional profile';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.subscriptions (professional_id, plan, status)
      values ('00000000-0000-4000-8000-000000000503', 'PRO', 'active');
    raise exception 'client created subscription';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.professional_services (professional_id, title)
      values ('00000000-0000-4000-8000-000000000503', 'Fake service');
    raise exception 'customer impersonated provider';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.posts (author_id, title, body)
      values ('00000000-0000-4000-8000-000000000501', 'Fake realization', 'Fake realization');
    raise exception 'customer published professional realization';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.service_request_responses (request_id, professional_id, message)
      values ('00000000-0000-4000-8000-000000000506',
              '00000000-0000-4000-8000-000000000503', 'Fake response');
    raise exception 'customer answered as provider';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.conversations (created_by, recipient_id, context)
      values ('00000000-0000-4000-8000-000000000501',
              '00000000-0000-4000-8000-000000000502', 'profile');
    raise exception 'customer contacted customer';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.conversations (created_by, recipient_id, context)
      values ('00000000-0000-4000-8000-000000000501',
              '00000000-0000-4000-8000-000000000504', 'profile');
    raise exception 'customer contacted pending professional';
  exception when insufficient_privilege then null;
  end;
  insert into public.conversations (created_by, recipient_id, context)
    values ('00000000-0000-4000-8000-000000000501',
            '00000000-0000-4000-8000-000000000503', 'profile');
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000503', true);
do $$
begin
  begin
    insert into public.conversations (created_by, recipient_id, context)
      values ('00000000-0000-4000-8000-000000000503',
              '00000000-0000-4000-8000-000000000502', 'profile');
    raise exception 'professional sent unsolicited contact';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.conversations (created_by, recipient_id, context)
      values ('00000000-0000-4000-8000-000000000503',
              '00000000-0000-4000-8000-000000000505', 'profile');
    raise exception 'professional contacted professional';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.service_request_responses (request_id, professional_id, message)
      values ('00000000-0000-4000-8000-000000000507',
              '00000000-0000-4000-8000-000000000503', 'Uninvited response');
    raise exception 'professional answered another provider private request';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.conversations (created_by, recipient_id, context, request_id)
      values ('00000000-0000-4000-8000-000000000503',
              '00000000-0000-4000-8000-000000000502', 'request',
              '00000000-0000-4000-8000-000000000506');
    raise exception 'professional contacted request owner before responding';
  exception when insufficient_privilege then null;
  end;
  insert into public.service_request_responses (request_id, professional_id, message)
    values ('00000000-0000-4000-8000-000000000506',
            '00000000-0000-4000-8000-000000000503', 'Legitimate response');
  insert into public.conversations (created_by, recipient_id, context, request_id)
    values ('00000000-0000-4000-8000-000000000503',
            '00000000-0000-4000-8000-000000000502', 'request',
            '00000000-0000-4000-8000-000000000506');
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000504', true);
do $$
begin
  if (select count(*) from public.professional_profiles
      where user_id = '00000000-0000-4000-8000-000000000504') <> 1 then
    raise exception 'pending professional cannot inspect own verification status';
  end if;
  begin
    insert into public.posts (author_id, title, body)
      values ('00000000-0000-4000-8000-000000000504', 'Premature post', 'Premature post');
    raise exception 'pending professional published';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.professional_services (professional_id, title)
      values ('00000000-0000-4000-8000-000000000504', 'Premature service');
    raise exception 'pending professional offered service';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
