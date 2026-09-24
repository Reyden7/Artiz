-- All professional privileges derive from the stored account type and the
-- server-controlled verification status. Never authorize from user metadata.
create function app_private.is_customer(subject_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select subject_id is not null and exists (
    select 1 from public.profiles p
    where p.id = subject_id and p.account_type = 'customer'
  );
$$;
create function app_private.is_verified_professional(subject_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select subject_id is not null and exists (
    select 1 from public.profiles p
    join public.professional_profiles professional on professional.user_id = p.id
    where p.id = subject_id and p.account_type = 'professional'
      and professional.verification_status = 'verified'
  );
$$;
create function app_private.can_respond_to_request(subject_id uuid, target_request_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_verified_professional(subject_id) and exists (
    select 1 from public.service_requests r
    where r.id = target_request_id and r.status = 'open'
      and ((r.visibility = 'public' and r.recipient_id is null)
        or (r.visibility = 'private' and r.recipient_id = subject_id))
  );
$$;
revoke all on function app_private.is_customer(uuid),
  app_private.is_verified_professional(uuid),
  app_private.can_respond_to_request(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.is_customer(uuid),
  app_private.is_verified_professional(uuid),
  app_private.can_respond_to_request(uuid, uuid) to authenticated;

create or replace function app_private.can_publish_professionally()
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.is_verified_professional((select auth.uid()));
$$;

-- A verified directory entry always corresponds to a real professional.
drop policy professionals_read on public.professional_profiles;
create policy professionals_read on public.professional_profiles for select to authenticated
  using ((user_id = (select auth.uid()) and exists (
      select 1 from public.profiles p where p.id = user_id and p.account_type = 'professional'))
    or app_private.is_verified_professional(user_id));
drop policy professionals_edit_self on public.professional_profiles;
create policy professionals_edit_self on public.professional_profiles for update to authenticated
  using (user_id = (select auth.uid()) and app_private.is_verified_professional(user_id))
  with check (user_id = (select auth.uid()) and app_private.is_verified_professional(user_id));

drop policy category_links_read on public.professional_category_links;
create policy category_links_read on public.professional_category_links for select to authenticated
  using (app_private.is_verified_professional(professional_id));
drop policy category_links_add on public.professional_category_links;
create policy category_links_add on public.professional_category_links for insert to authenticated
  with check (professional_id = (select auth.uid())
    and app_private.is_verified_professional(professional_id));
drop policy category_links_remove on public.professional_category_links;
create policy category_links_remove on public.professional_category_links for delete to authenticated
  using (professional_id = (select auth.uid())
    and app_private.is_verified_professional(professional_id));

drop policy services_read on public.professional_services;
create policy services_read on public.professional_services for select to authenticated
  using (app_private.is_verified_professional(professional_id)
    and (is_active or professional_id = (select auth.uid())));
drop policy services_add on public.professional_services;
create policy services_add on public.professional_services for insert to authenticated
  with check (professional_id = (select auth.uid())
    and app_private.is_verified_professional(professional_id));
drop policy services_edit on public.professional_services;
create policy services_edit on public.professional_services for update to authenticated
  using (professional_id = (select auth.uid())
    and app_private.is_verified_professional(professional_id))
  with check (professional_id = (select auth.uid())
    and app_private.is_verified_professional(professional_id));
drop policy services_remove on public.professional_services;
create policy services_remove on public.professional_services for delete to authenticated
  using (professional_id = (select auth.uid())
    and app_private.is_verified_professional(professional_id));

-- Withdraw professional content from the public feed as soon as the account
-- loses verification. The author may still see their own historical posts.
drop policy posts_read on public.posts;
create policy posts_read on public.posts for select to authenticated using (
  author_id = (select auth.uid()) or
  (app_private.is_verified_professional(author_id) and status = 'published' and (
    visibility = 'network' or (visibility = 'contacts' and exists (
      select 1 from public.professional_follows f
      where f.professional_id = author_id and f.follower_id = (select auth.uid())
    ))
  ))
);
drop policy posts_edit on public.posts;
create policy posts_edit on public.posts for update to authenticated
  using (author_id = (select auth.uid()) and (select app_private.can_publish_professionally()))
  with check (author_id = (select auth.uid()) and (select app_private.can_publish_professionally()));
drop policy post_images_add on public.post_images;
create policy post_images_add on public.post_images for insert to authenticated
  with check ((select app_private.can_publish_professionally())
    and exists (select 1 from public.posts p
      where p.id = post_id and p.author_id = (select auth.uid()))
    and storage_path like (select auth.uid())::text || '/%');

drop policy follows_read on public.professional_follows;
create policy follows_read on public.professional_follows for select to authenticated
  using (app_private.is_verified_professional(professional_id));
drop policy follows_add on public.professional_follows;
create policy follows_add on public.professional_follows for insert to authenticated
  with check (follower_id = (select auth.uid())
    and app_private.is_verified_professional(professional_id));

drop policy requests_add on public.service_requests;
create policy requests_add on public.service_requests for insert to authenticated
  with check (customer_id = (select auth.uid())
    and app_private.is_customer(customer_id)
    and ((visibility = 'public' and recipient_id is null)
      or (visibility = 'private' and recipient_id is not null
        and app_private.is_verified_professional(recipient_id))));
drop policy requests_edit on public.service_requests;
create policy requests_edit on public.service_requests for update to authenticated
  using (customer_id = (select auth.uid()) and app_private.is_customer(customer_id))
  with check (customer_id = (select auth.uid()) and app_private.is_customer(customer_id)
    and ((visibility = 'public' and recipient_id is null)
      or (visibility = 'private' and recipient_id is not null
        and app_private.is_verified_professional(recipient_id))));
drop policy requests_read on public.service_requests;
create policy requests_read on public.service_requests for select to authenticated
  using (customer_id = (select auth.uid())
    or (recipient_id = (select auth.uid()) and app_private.is_verified_professional(recipient_id))
    or (visibility = 'public' and recipient_id is null
      and status in ('open', 'in_progress', 'closed')));
drop policy responses_add on public.service_request_responses;
create policy responses_add on public.service_request_responses for insert to authenticated
  with check (professional_id = (select auth.uid())
    and app_private.can_respond_to_request(professional_id, request_id));
drop policy responses_edit on public.service_request_responses;
create policy responses_edit on public.service_request_responses for update to authenticated
  using (professional_id = (select auth.uid())
    and app_private.is_verified_professional(professional_id))
  with check (professional_id = (select auth.uid())
    and app_private.is_verified_professional(professional_id));
drop policy responses_remove on public.service_request_responses;
create policy responses_remove on public.service_request_responses for delete to authenticated
  using (professional_id = (select auth.uid())
    and app_private.is_verified_professional(professional_id));

drop policy reviews_add on public.reviews;
create policy reviews_add on public.reviews for insert to authenticated
  with check (customer_id = (select auth.uid()) and app_private.is_customer(customer_id)
    and app_private.is_verified_professional(professional_id)
    and (request_id is null or exists (
      select 1 from public.service_requests r
      where r.id = reviews.request_id and r.customer_id = reviews.customer_id)));

-- Conversation creation still uses one central decision, with these same
-- authoritative role helpers. A published request alone never permits spam:
-- the professional must first have an authorized response to that request.
create or replace function app_private.can_create_conversation(
  sender_id uuid, target_id uuid, contact_context text, target_request_id uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select sender_id = (select auth.uid()) and sender_id <> target_id and (
    (app_private.is_customer(sender_id)
      and app_private.is_verified_professional(target_id)
      and ((target_request_id is null
          and contact_context in ('profile', 'post', 'search', 'quote'))
        or (target_request_id is not null
          and contact_context in ('quote', 'request')
          and exists (select 1 from public.service_requests r
            where r.id = target_request_id and r.customer_id = sender_id
              and r.recipient_id = target_id))))
    or
    (app_private.is_verified_professional(sender_id)
      and app_private.is_customer(target_id)
      and ((contact_context = 'request' and target_request_id is not null
        and exists (select 1 from public.service_requests r
          join public.service_request_responses response on response.request_id = r.id
          where r.id = target_request_id and r.customer_id = target_id
            and r.status in ('open', 'in_progress', 'closed')
            and response.professional_id = sender_id
            and response.status in ('sent', 'accepted')))
        or (contact_context = 'reply' and target_request_id is null
          and exists (select 1 from public.conversations previous
            where previous.created_by = target_id
              and previous.recipient_id = sender_id))))
  );
$$;

create or replace function app_private.can_send_in_conversation(target_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.conversations c
    join public.conversation_members member
      on member.conversation_id = c.id and member.user_id = (select auth.uid())
    where c.id = target_conversation
      and ((app_private.is_customer(c.created_by)
          and app_private.is_verified_professional(c.recipient_id))
        or (app_private.is_verified_professional(c.created_by)
          and app_private.is_customer(c.recipient_id)))
  );
$$;

drop policy artiz_covers_read on storage.objects;
create policy artiz_covers_read on storage.objects for select to authenticated
  using (bucket_id = 'covers' and (split_part(name, '/', 1) = (select auth.uid())::text
    or exists (select 1 from public.professional_profiles p
      where p.cover_path = name and app_private.is_verified_professional(p.user_id))));
