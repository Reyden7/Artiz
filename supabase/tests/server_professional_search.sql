-- Direct RPC tests; fixtures are rolled back.
begin;
insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000921'),
  ('00000000-0000-4000-8000-000000000922'),
  ('00000000-0000-4000-8000-000000000923');
update public.profiles set account_type = 'professional'
  where id in ('00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000922');
insert into public.professional_profiles (user_id, business_name, city, verification_status) values
  ('00000000-0000-4000-8000-000000000921', 'Atelier Recherche', 'Annecy', 'verified'),
  ('00000000-0000-4000-8000-000000000922', 'Atelier En Attente', 'Annecy', 'pending');
insert into public.professional_categories (id, slug, name) values
  ('00000000-0000-4000-8000-000000000924', 'fixture-ceramiste', 'Céramiste de test');
insert into public.professional_category_links (professional_id, category_id) values
  ('00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000924');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000923', true);
do $$ begin
  if (select count(*) from public.search_professionals('Atelier', null, null, 0, 20)) <> 1 then
    raise exception 'unverified professional leaked into search';
  end if;
  if (select count(*) from public.search_professionals('', null, 'Annecy', 0, 20)
      where user_id = '00000000-0000-4000-8000-000000000921') <> 1 then
    raise exception 'city search failed';
  end if;
  if exists (select 1 from public.search_professionals('Introuvable', null, null, 0, 20)) then
    raise exception 'text search returned unrelated account';
  end if;
  if (select count(*) from public.search_professionals('Céramiste de test', null, null, 0, 20)
      where user_id = '00000000-0000-4000-8000-000000000921') <> 1 then
    raise exception 'profession search failed';
  end if;
end; $$;
rollback;
