-- A device can rotate its Expo token or switch accounts after Expo accepts a push.
-- Keep the delivery ticket so its receipt can still be checked after revocation.
alter table app_private.push_deliveries
  drop constraint push_deliveries_token_id_fkey;

alter table app_private.push_deliveries
  alter column token_id drop not null;

alter table app_private.push_deliveries
  add constraint push_deliveries_token_id_fkey
  foreign key (token_id) references public.push_tokens(id) on delete set null;

create function app_private.disable_push_deliveries_for_revoked_token()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update app_private.push_deliveries
  set status = case when status in ('pending', 'processing') then 'disabled' else status end,
      updated_at = now()
  where token_id = old.id;
  return old;
end;
$$;

create trigger disable_push_deliveries_for_revoked_token
  before delete on public.push_tokens
  for each row execute function app_private.disable_push_deliveries_for_revoked_token();

revoke all on function app_private.disable_push_deliveries_for_revoked_token()
  from public, anon, authenticated;
