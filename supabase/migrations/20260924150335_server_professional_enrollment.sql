-- Invoked only by the authenticated Edge Function using its server key.
-- The registry check happens immediately before this atomic transaction.
create function public.complete_professional_registration(
  subject_id uuid,
  submitted_siret text,
  submitted_business_name text,
  registry_legal_name text
)
returns void language plpgsql security definer set search_path = '' as $$
declare current_account_type text;
begin
  if submitted_siret !~ '^[0-9]{14}$'
    or char_length(btrim(coalesce(submitted_business_name, ''))) not between 2 and 150
    or char_length(btrim(coalesce(registry_legal_name, ''))) not between 2 and 250 then
    raise exception 'Invalid professional registration fields' using errcode = '22023';
  end if;

  select p.account_type into current_account_type
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = subject_id
  for update of p;
  if current_account_type is distinct from 'customer' then
    raise exception 'Account cannot enroll as professional' using errcode = '23514';
  end if;
  if exists (select 1 from public.professional_profiles p where p.user_id = subject_id) then
    raise exception 'Professional application already exists' using errcode = '23505';
  end if;

  update public.profiles set account_type = 'professional' where id = subject_id;
  insert into public.professional_profiles
    (user_id, business_name, verification_status)
  values (subject_id, btrim(submitted_business_name), 'pending');
  insert into app_private.professional_verifications
    (user_id, siret, legal_name, checked_at, verification_source)
  values (subject_id, submitted_siret, btrim(registry_legal_name), now(),
          'recherche-entreprises.api.gouv.fr');
  insert into public.subscriptions (professional_id, plan, status)
  values (subject_id, 'FREE', 'active');
end;
$$;
revoke all on function public.complete_professional_registration(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_professional_registration(uuid, text, text, text)
  to service_role;
