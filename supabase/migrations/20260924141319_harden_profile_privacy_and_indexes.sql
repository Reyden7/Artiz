-- Exact customer coordinates are private. Public profiles retain city/postal code.
create table public.profile_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);
insert into public.profile_locations (user_id, latitude, longitude)
select id, latitude, longitude from public.profiles
where latitude is not null and longitude is not null;
alter table public.profiles drop column latitude, drop column longitude;
create trigger set_updated_at before update on public.profile_locations
for each row execute function app_private.touch_updated_at();
alter table public.profile_locations enable row level security;
revoke all on public.profile_locations from public, anon, authenticated;
grant select, insert, delete on public.profile_locations to authenticated;
grant update (latitude, longitude) on public.profile_locations to authenticated;
create policy profile_locations_read_self on public.profile_locations for select to authenticated
  using (user_id = (select auth.uid()));
create policy profile_locations_add_self on public.profile_locations for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profile_locations_edit_self on public.profile_locations for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profile_locations_remove_self on public.profile_locations for delete to authenticated
  using (user_id = (select auth.uid()));

-- Explicitly deny client access to verification records even if a grant is added later.
create policy no_client_verification_access on app_private.professional_verifications
for all to authenticated using (false) with check (false);

-- Cover foreign keys used for joins and for ON DELETE checks.
create index conversations_created_by_idx on public.conversations(created_by);
create index conversations_request_idx on public.conversations(request_id);
create index messages_sender_idx on public.messages(sender_id);
create index notifications_actor_idx on public.notifications(actor_id);
create index post_comments_author_idx on public.post_comments(author_id);
create index posts_category_idx on public.posts(category_id);
create index professional_services_category_idx on public.professional_services(category_id);
create index reports_reporter_idx on public.reports(reporter_id);
create index reports_target_post_idx on public.reports(target_post_id);
create index reports_target_user_idx on public.reports(target_user_id);
create index reviews_professional_idx on public.reviews(professional_id);
create index reviews_request_idx on public.reviews(request_id);
create unique index reviews_one_general_per_pair on public.reviews(customer_id, professional_id)
  where request_id is null;
