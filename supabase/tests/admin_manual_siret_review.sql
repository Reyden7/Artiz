-- Run as database owner. All fixture accounts and decisions are rolled back.
begin;
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000701', 'artiz-admin-fixture@example.test', now()),
  ('00000000-0000-4000-8000-000000000702', 'artiz-applicant-fixture@example.test', now());
insert into app_private.admin_members (user_id)
values ('00000000-0000-4000-8000-000000000701');
select public.complete_professional_registration(
  '00000000-0000-4000-8000-000000000702',
  '99999999999999', 'Atelier de test', 'Atelier de test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000702', true);
do $$ begin
  begin
    perform public.review_professional_affiliation(
      '00000000-0000-4000-8000-000000000702',
      '00000000-0000-4000-8000-000000000701', 'verified', '', '');
    raise exception 'applicant called administrator RPC directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pending_professional_reviews('00000000-0000-4000-8000-000000000701');
    raise exception 'applicant listed private applications directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_professional_registry_snapshot(
      '00000000-0000-4000-8000-000000000702', '99999999999999', '', '', '{}'::jsonb);
    raise exception 'applicant forged registry data directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.professional_profiles set verification_status = 'verified'
      where user_id = '00000000-0000-4000-8000-000000000702';
    raise exception 'applicant verified their own profile';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.posts (author_id, title, body)
      values ('00000000-0000-4000-8000-000000000702', 'Publication prématurée', 'Publication prématurée');
    raise exception 'pending professional published directly';
  exception when insufficient_privilege then null;
  end;
end; $$;
reset role;

do $$ begin
  begin
    perform public.review_professional_affiliation(
      '00000000-0000-4000-8000-000000000702',
      '00000000-0000-4000-8000-000000000702', 'verified', '', '');
    raise exception 'non-administrator approved applicant';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.review_professional_affiliation(
      '00000000-0000-4000-8000-000000000702',
      '00000000-0000-4000-8000-000000000701', 'verified', '', '');
    raise exception 'approval without recent registry snapshot succeeded';
  exception when invalid_parameter_value then null;
  end;
end; $$;

select public.save_professional_registry_snapshot(
  '00000000-0000-4000-8000-000000000702', '99999999999999', 'Paris', '75000',
  '{"siret":"99999999999999","company_status":"F","establishment_status":"A","source":"recherche-entreprises.api.gouv.fr"}'::jsonb);
do $$ begin
  begin
    perform public.review_professional_affiliation(
      '00000000-0000-4000-8000-000000000702',
      '00000000-0000-4000-8000-000000000701', 'verified', '', '');
    raise exception 'inactive registry status was approved';
  exception when invalid_parameter_value then null;
  end;
end; $$;
select public.save_professional_registry_snapshot(
  '00000000-0000-4000-8000-000000000702', '99999999999999', 'Paris', '75000',
  '{"siret":"99999999999999","company_status":"A","establishment_status":"A","source":"recherche-entreprises.api.gouv.fr"}'::jsonb);
select public.review_professional_affiliation(
  '00000000-0000-4000-8000-000000000702',
  '00000000-0000-4000-8000-000000000701', 'verified', '', 'Contrôle manuel');
do $$ begin
  if not exists (select 1 from public.professional_profiles
      where user_id = '00000000-0000-4000-8000-000000000702'
        and verification_status = 'verified') then
    raise exception 'administrator approval was not saved';
  end if;
  if not exists (select 1 from app_private.professional_verification_decisions
      where professional_id = '00000000-0000-4000-8000-000000000702'
        and admin_id = '00000000-0000-4000-8000-000000000701'
        and decision = 'verified') then
    raise exception 'administrator audit record is missing';
  end if;
end; $$;
rollback;
