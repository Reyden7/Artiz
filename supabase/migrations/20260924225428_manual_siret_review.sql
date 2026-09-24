-- The administrator manually approves an active SIRET after reviewing the official registry.
-- No additional document is required from the applicant.
create or replace function public.review_professional_affiliation(
  subject_id uuid, reviewer_id uuid, decision text,
  affiliation_evidence text, note text
) returns void language plpgsql security definer set search_path = '' as $$
declare current_status text;
declare registry app_private.professional_verifications%rowtype;
begin
  if not public.is_artiz_admin(reviewer_id) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if decision not in ('verified', 'rejected')
    or char_length(coalesce(note, '')) > 1000 then
    raise exception 'Invalid review decision' using errcode = '22023';
  end if;
  select p.verification_status into current_status
    from public.professional_profiles p where p.user_id = subject_id for update;
  if current_status is distinct from 'pending' then
    raise exception 'Application is not pending' using errcode = '23514';
  end if;
  if decision = 'verified' then
    select * into registry from app_private.professional_verifications v
      where v.user_id = subject_id;
    if registry.user_id is null
      or registry.checked_at < now() - interval '10 minutes'
      or registry.registry_data ->> 'siret' is distinct from registry.siret
      or registry.registry_data ->> 'company_status' is distinct from 'A'
      or registry.registry_data ->> 'establishment_status' is distinct from 'A'
      or registry.registry_data ->> 'source' is distinct from 'recherche-entreprises.api.gouv.fr' then
      raise exception 'A recent active registry check is required' using errcode = '22023';
    end if;
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
    case when decision = 'verified' then 'Contrôle manuel du SIRET et du registre officiel' else null end,
    nullif(btrim(note), ''));
end;
$$;
