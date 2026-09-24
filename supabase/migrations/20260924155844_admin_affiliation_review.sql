-- Administrative entitlement is independent from the exclusive account type.
create table app_private.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table app_private.admin_members enable row level security;
revoke all on app_private.admin_members from public, anon, authenticated;

alter table app_private.professional_verifications
  add column registry_commune text,
  add column registry_postal_code text,
  add column registry_data jsonb not null default '{}'::jsonb,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users(id),
  add column verification_note text;

create table app_private.professional_verification_decisions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  admin_id uuid not null references app_private.admin_members(user_id),
  decision text not null check (decision in ('verified', 'rejected')),
  affiliation_evidence text,
  note text,
  created_at timestamptz not null default now()
);
alter table app_private.professional_verification_decisions enable row level security;
revoke all on app_private.professional_verification_decisions from public, anon, authenticated;

create function public.is_artiz_admin(subject_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app_private.admin_members a
    join auth.users u on u.id = a.user_id
    where a.user_id = subject_id and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_artiz_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_artiz_admin(uuid) to service_role;

create function public.pending_professional_reviews(admin_id uuid)
returns table (
  user_id uuid, email text, display_name text, business_name text,
  siret text, legal_name text, commune text, postal_code text,
  applied_at timestamptz, registry_data jsonb
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_artiz_admin(admin_id) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
    select p.user_id, u.email::text, a.display_name, p.business_name,
      v.siret::text, v.legal_name, v.registry_commune, v.registry_postal_code,
      v.created_at, v.registry_data
    from public.professional_profiles p
    join public.profiles a on a.id = p.user_id
    join auth.users u on u.id = p.user_id
    join app_private.professional_verifications v on v.user_id = p.user_id
    where p.verification_status = 'pending'
    order by v.created_at asc;
end;
$$;
revoke all on function public.pending_professional_reviews(uuid) from public, anon, authenticated;
grant execute on function public.pending_professional_reviews(uuid) to service_role;

create function public.save_professional_registry_snapshot(
  subject_id uuid, submitted_siret text, commune text, postal_code text, snapshot jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(snapshot) is distinct from 'object'
    or pg_catalog.octet_length(snapshot::text) > 16000
    or char_length(coalesce(commune, '')) > 150
    or char_length(coalesce(postal_code, '')) > 20 then
    raise exception 'Invalid registry snapshot' using errcode = '22023';
  end if;
  update app_private.professional_verifications v
    set registry_commune = nullif(btrim(commune), ''),
        registry_postal_code = nullif(btrim(postal_code), ''),
        registry_data = snapshot,
        checked_at = now()
    where v.user_id = subject_id and v.siret = submitted_siret;
  if not found then
    raise exception 'Professional verification not found' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.save_professional_registry_snapshot(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_professional_registry_snapshot(uuid, text, text, text, jsonb)
  to service_role;

create function public.review_professional_affiliation(
  subject_id uuid, reviewer_id uuid, decision text,
  affiliation_evidence text, note text
) returns void language plpgsql security definer set search_path = '' as $$
declare current_status text;
begin
  if not public.is_artiz_admin(reviewer_id) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if decision not in ('verified', 'rejected')
    or char_length(coalesce(note, '')) > 1000
    or char_length(coalesce(affiliation_evidence, '')) > 1000
    or (decision = 'verified' and char_length(btrim(coalesce(affiliation_evidence, ''))) < 12) then
    raise exception 'A documented affiliation check is required' using errcode = '22023';
  end if;
  select p.verification_status into current_status
    from public.professional_profiles p where p.user_id = subject_id for update;
  if current_status is distinct from 'pending' then
    raise exception 'Application is not pending' using errcode = '23514';
  end if;
  update public.professional_profiles p
    set verification_status = decision where p.user_id = subject_id;
  update app_private.professional_verifications v
    set reviewed_at = now(), reviewed_by = reviewer_id,
        verification_note = nullif(btrim(note), '')
    where v.user_id = subject_id;
  insert into app_private.professional_verification_decisions
    (professional_id, admin_id, decision, affiliation_evidence, note)
  values (subject_id, reviewer_id, decision,
    nullif(btrim(affiliation_evidence), ''), nullif(btrim(note), ''));
end;
$$;
revoke all on function public.review_professional_affiliation(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.review_professional_affiliation(uuid, uuid, text, text, text)
  to service_role;
