-- Run as a database owner. All fixtures are rolled back.
begin;
insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000301'), -- customer / owner
  ('00000000-0000-4000-8000-000000000302'), -- professional / recipient
  ('00000000-0000-4000-8000-000000000303'), -- unrelated customer
  ('00000000-0000-4000-8000-000000000304'); -- unrelated professional
update public.profiles set account_type = 'professional'
where id in ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000304');
insert into public.professional_profiles (user_id, business_name, verification_status)
values ('00000000-0000-4000-8000-000000000302', 'Atelier Test', 'verified'),
       ('00000000-0000-4000-8000-000000000304', 'Atelier Tiers', 'verified');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000301', true);
insert into public.service_requests (customer_id, recipient_id, visibility, title, description, city)
values ('00000000-0000-4000-8000-000000000301',
        '00000000-0000-4000-8000-000000000302', 'private',
        'Bibliothèque', 'Bibliothèque sur mesure', 'Annecy');
do $$ begin
  if (select count(*) from public.service_requests where visibility = 'private') <> 1 then
    raise exception 'owner cannot read private quote';
  end if;
end; $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000302', true);
do $$ begin
  if (select count(*) from public.service_requests where visibility = 'private') <> 1 then
    raise exception 'recipient cannot read private quote';
  end if;
end; $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000303', true);
do $$ begin
  if (select count(*) from public.service_requests where visibility = 'private') <> 0 then
    raise exception 'unrelated customer can read private quote';
  end if;
end; $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000304', true);
do $$ begin
  if (select count(*) from public.service_requests where visibility = 'private') <> 0 then
    raise exception 'unrelated professional can read private quote';
  end if;
end; $$;
rollback;
