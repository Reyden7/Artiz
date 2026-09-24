-- A quote addressed to one professional must not appear in the public request board.
alter table public.service_requests
  add column recipient_id uuid references public.professional_profiles(user_id) on delete set null,
  add column visibility text not null default 'public' check (visibility in ('public', 'private')),
  add constraint private_or_undirected_request check (visibility = 'private' or recipient_id is null);
create index service_requests_recipient_idx on public.service_requests(recipient_id, created_at desc)
  where recipient_id is not null;

drop policy requests_read on public.service_requests;
create policy requests_read on public.service_requests for select to authenticated
  using (customer_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or (visibility = 'public' and recipient_id is null
      and status in ('open', 'in_progress', 'closed')));

drop policy requests_add on public.service_requests;
create policy requests_add on public.service_requests for insert to authenticated
  with check (customer_id = (select auth.uid())
    and exists (select 1 from public.profiles p
      where p.id = customer_id and p.account_type = 'customer')
    and ((visibility = 'public' and recipient_id is null)
      or (visibility = 'private' and recipient_id is not null and exists (
        select 1 from public.professional_profiles p
        where p.user_id = recipient_id and p.verification_status = 'verified'))));
