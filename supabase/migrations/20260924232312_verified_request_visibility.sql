-- Public needs are visible to their author and verified professionals.
-- A pending provider or another customer cannot harvest customer projects.
drop policy requests_read on public.service_requests;
create policy requests_read on public.service_requests for select to authenticated
  using (customer_id = (select auth.uid())
    or (app_private.is_verified_professional((select auth.uid()))
      and (recipient_id = (select auth.uid())
        or (visibility = 'public' and recipient_id is null
          and status in ('open', 'in_progress', 'closed')))));
