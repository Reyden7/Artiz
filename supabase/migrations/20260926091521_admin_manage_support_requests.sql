-- Support agents may correct ticket details and remove a ticket after review.
-- Identity, device metadata, timestamps, and screenshot ownership remain immutable.
grant update (category, subject, description, contact_email)
  on public.support_requests to authenticated;
grant delete on public.support_requests to authenticated;

create policy support_requests_admin_delete on public.support_requests
  for delete to authenticated
  using ((select public.is_artiz_admin_self()));

-- Screenshot deletion is needed when an administrator removes a ticket.
create policy support_screenshots_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'support-screenshots' and (select public.is_artiz_admin_self()));

create index notifications_support_request_lookup_idx
  on public.notifications ((payload->>'support_request_id'))
  where kind = 'support_request';

create function app_private.remove_deleted_support_request_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications n
    where n.kind = 'support_request'
      and n.payload->>'support_request_id' = old.id::text;
  return old;
end;
$$;
revoke all on function app_private.remove_deleted_support_request_notifications()
  from public, anon, authenticated;
create trigger support_request_remove_notifications
  after delete on public.support_requests
  for each row execute function app_private.remove_deleted_support_request_notifications();
