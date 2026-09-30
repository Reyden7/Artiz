-- A reviewer can close their account without preventing deletion of a
-- professional verification they previously handled.
alter table app_private.professional_verifications
  drop constraint professional_verifications_reviewed_by_fkey;

alter table app_private.professional_verifications
  add constraint professional_verifications_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;

-- Remove cross-user notifications/reports about the deleted account, and
-- discard any unconsumed registration intent tied to its email.
create function app_private.cleanup_deleted_account_references()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications where actor_id = old.id;
  delete from public.reports where target_user_id = old.id
    or target_post_id in (select id from public.posts where author_id = old.id);
  delete from app_private.professional_signup_intents
    where email = lower(btrim(old.email));
  return old;
end;
$$;
revoke all on function app_private.cleanup_deleted_account_references()
  from public, anon, authenticated;
create trigger cleanup_deleted_account_references before delete on auth.users
for each row execute function app_private.cleanup_deleted_account_references();
