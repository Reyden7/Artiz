-- Enrollment requires an authenticated session. Remove the pre-auth intent
-- experiment before any public Edge Function is exposed.
create or replace function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 100));
  return new;
end;
$$;
drop function public.prepare_professional_signup(text, text, text, text);
drop table app_private.professional_signup_intents;
