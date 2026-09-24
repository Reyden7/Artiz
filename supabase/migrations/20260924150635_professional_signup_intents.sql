-- A one-time intent is created only after the server has looked up an exact,
-- active SIRET in the official registry. User metadata carries only its token.
create table app_private.professional_signup_intents (
  token uuid primary key default gen_random_uuid(),
  email text not null,
  siret char(14) not null check (siret ~ '^[0-9]{14}$'),
  business_name text not null check (char_length(business_name) between 2 and 150),
  legal_name text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);
create index professional_signup_intents_expiry_idx
  on app_private.professional_signup_intents(expires_at);
alter table app_private.professional_signup_intents enable row level security;
revoke all on app_private.professional_signup_intents from public, anon, authenticated;

create function public.prepare_professional_signup(
  submitted_email text,
  submitted_siret text,
  submitted_business_name text,
  registry_legal_name text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare intent_token uuid;
begin
  if submitted_email is null or char_length(btrim(submitted_email)) not between 3 and 254
    or position('@' in submitted_email) = 0
    or submitted_siret !~ '^[0-9]{14}$'
    or char_length(btrim(coalesce(submitted_business_name, ''))) not between 2 and 150
    or char_length(btrim(coalesce(registry_legal_name, ''))) not between 2 and 250 then
    raise exception 'Invalid professional registration fields' using errcode = '22023';
  end if;
  insert into app_private.professional_signup_intents
    (email, siret, business_name, legal_name)
  values (lower(btrim(submitted_email)), submitted_siret,
          btrim(submitted_business_name), btrim(registry_legal_name))
  returning token into intent_token;
  return intent_token;
end;
$$;
revoke all on function public.prepare_professional_signup(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_professional_signup(text, text, text, text)
  to service_role;

create or replace function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare intent app_private.professional_signup_intents%rowtype;
declare intent_text text;
begin
  -- raw_user_meta_data is untrusted. Its token has no authority without a
  -- matching, unexpired private intent tied to the Auth email.
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 100));

  intent_text := new.raw_user_meta_data ->> 'professional_intent';
  if intent_text is null then return new; end if;
  if intent_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Invalid professional signup intent' using errcode = '22023';
  end if;
  select * into intent from app_private.professional_signup_intents i
  where i.token = intent_text::uuid for update;
  if not found or intent.expires_at <= now()
    or intent.email <> lower(btrim(coalesce(new.email, ''))) then
    raise exception 'Professional signup intent expired or mismatched'
      using errcode = '22023';
  end if;

  perform public.complete_professional_registration(
    new.id, intent.siret::text, intent.business_name, intent.legal_name);
  delete from app_private.professional_signup_intents where token = intent.token;
  return new;
end;
$$;
