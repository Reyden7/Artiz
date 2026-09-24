-- A compromised customer account cannot fan out unlimited registry lookups.
create table app_private.professional_registration_attempts (
  subject_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index professional_registration_attempts_lookup_idx
  on app_private.professional_registration_attempts(subject_id, attempted_at desc);
alter table app_private.professional_registration_attempts enable row level security;
revoke all on app_private.professional_registration_attempts from public, anon, authenticated;

create function public.record_professional_registration_attempt(subject_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if subject_id is null or not exists
    (select 1 from auth.users where id = subject_id) then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(subject_id::text, 0));
  delete from app_private.professional_registration_attempts
    where professional_registration_attempts.subject_id = record_professional_registration_attempt.subject_id
      and attempted_at < now() - interval '7 days';
  if (select count(*) from app_private.professional_registration_attempts a
      where a.subject_id = record_professional_registration_attempt.subject_id
        and a.attempted_at > now() - interval '1 hour') >= 5 then
    return false;
  end if;
  insert into app_private.professional_registration_attempts (subject_id)
  values (record_professional_registration_attempt.subject_id);
  return true;
end;
$$;
revoke all on function public.record_professional_registration_attempt(uuid)
  from public, anon, authenticated;
grant execute on function public.record_professional_registration_attempt(uuid)
  to service_role;
