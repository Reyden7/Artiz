-- Artiz: first version of the application data model.
-- The mobile client only receives a publishable key. Privileged writes belong to
-- server-side code; account_type and subscriptions are never client-controlled.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create extension if not exists pgcrypto with schema extensions;

create or replace function app_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  account_type text not null default 'customer' check (account_type in ('customer', 'professional', 'admin')),
  avatar_path text,
  city text,
  postal_code text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  bio text check (char_length(bio) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- A user may edit raw_user_meta_data: only harmless display text is copied.
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 100));
  return new;
end;
$$;
revoke all on function app_private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
for each row execute function app_private.handle_new_user();

create table public.professional_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.professional_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 150),
  headline text check (char_length(headline) <= 180),
  description text check (char_length(description) <= 3000),
  cover_path text,
  website_url text,
  city text,
  postal_code text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  service_radius_km integer not null default 30 check (service_radius_km between 1 and 500),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SIRET is intentionally kept out of the public Data API.
create table app_private.professional_verifications (
  user_id uuid primary key references public.professional_profiles(user_id) on delete cascade,
  siret char(14) not null unique check (siret ~ '^[0-9]{14}$'),
  legal_name text,
  checked_at timestamptz,
  verification_source text,
  created_at timestamptz not null default now()
);

create table public.professional_category_links (
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  category_id uuid not null references public.professional_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (professional_id, category_id)
);

create table public.professional_services (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  category_id uuid references public.professional_categories(id) on delete set null,
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- FREE is a real plan; billing status never defines whether an account is professional.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  plan text not null check (plan in ('FREE', 'PRO', 'PRO_PLUS')),
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  provider text,
  provider_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create unique index subscriptions_one_current_per_professional
  on public.subscriptions(professional_id)
  where status in ('active', 'trialing', 'past_due');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  category_id uuid references public.professional_categories(id) on delete set null,
  city text,
  visibility text not null default 'network' check (visibility in ('network', 'contacts', 'private')),
  in_portfolio boolean not null default false,
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null unique,
  position smallint not null check (position between 0 and 9),
  created_at timestamptz not null default now(),
  unique (post_id, position)
);
create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.post_saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table public.professional_follows (
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  follower_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (professional_id, follower_id),
  check (professional_id <> follower_id)
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.professional_categories(id) on delete set null,
  title text not null check (char_length(title) between 5 and 150),
  description text not null check (char_length(description) between 10 and 3000),
  city text not null,
  postal_code text,
  budget_min_cents integer check (budget_min_cents >= 0),
  budget_max_cents integer check (budget_max_cents >= 0),
  desired_by date,
  status text not null default 'open' check (status in ('draft', 'open', 'in_progress', 'closed', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_max_cents is null or budget_min_cents is null or budget_max_cents >= budget_min_cents)
);
create table public.service_request_images (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  storage_path text not null unique,
  position smallint not null check (position between 0 and 4),
  created_at timestamptz not null default now(),
  unique (request_id, position)
);
create table public.service_request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, professional_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  request_id uuid references public.service_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  request_id uuid references public.service_requests(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_id <> professional_id),
  unique (customer_id, professional_id, request_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null,
  target_post_id uuid references public.posts(id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(target_user_id, target_post_id) = 1)
);

-- Keep timestamps server-generated. Clients can only edit explicitly granted columns.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'professional_profiles', 'professional_services', 'subscriptions',
    'posts', 'post_comments', 'service_requests', 'service_request_responses',
    'conversations', 'reviews', 'reports'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function app_private.touch_updated_at()', table_name);
  end loop;
end;
$$;

create index posts_feed_idx on public.posts(created_at desc) where status = 'published';
create index posts_author_idx on public.posts(author_id, created_at desc);
create index post_comments_post_idx on public.post_comments(post_id, created_at);
create index professional_profiles_location_idx on public.professional_profiles(postal_code, city);
create index professional_category_links_category_idx on public.professional_category_links(category_id, professional_id);
create index professional_services_professional_idx on public.professional_services(professional_id);
create index professional_follows_follower_idx on public.professional_follows(follower_id);
create index post_likes_user_idx on public.post_likes(user_id);
create index post_saves_user_idx on public.post_saves(user_id);
create index service_requests_open_idx on public.service_requests(category_id, created_at desc) where status = 'open';
create index service_requests_customer_idx on public.service_requests(customer_id, created_at desc);
create index service_request_responses_professional_idx on public.service_request_responses(professional_id);
create index conversation_members_user_idx on public.conversation_members(user_id, conversation_id);
create index messages_conversation_idx on public.messages(conversation_id, created_at desc);
create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);
create index reports_status_idx on public.reports(status, created_at);

insert into public.professional_categories (slug, name) values
  ('menuiserie-bois', 'Menuiserie et bois'),
  ('renovation-habitat', 'Rénovation de l’habitat'),
  ('decoration-interieur', 'Décoration d’intérieur'),
  ('maconnerie', 'Maçonnerie'),
  ('jardin-exterieur', 'Jardin et extérieur'),
  ('plomberie-chauffage', 'Plomberie et chauffage'),
  ('peinture-finitions', 'Peinture et finitions'),
  ('art-creation', 'Art et création');

-- Existing Auth accounts, if any, also receive a customer profile.
insert into public.profiles (id, display_name)
select id, left(coalesce(raw_user_meta_data ->> 'display_name', ''), 100)
from auth.users on conflict (id) do nothing;

create or replace function app_private.is_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation and cm.user_id = (select auth.uid())
  );
$$;
revoke all on function app_private.is_conversation_member(uuid) from public, anon, authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_conversation_member(uuid) to authenticated;

create or replace function app_private.can_add_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and exists (select 1 from public.conversations c where c.id = target_conversation and c.created_by = (select auth.uid()))
    and (select count(*) from public.conversation_members cm where cm.conversation_id = target_conversation) < 2;
$$;
revoke all on function app_private.can_add_conversation_member(uuid) from public, anon, authenticated;
grant execute on function app_private.can_add_conversation_member(uuid) to authenticated;

create or replace function app_private.add_conversation_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.conversation_members (conversation_id, user_id)
  values (new.id, new.created_by);
  return new;
end;
$$;
revoke all on function app_private.add_conversation_creator() from public, anon, authenticated;
create trigger conversation_creator_is_member after insert on public.conversations
for each row execute function app_private.add_conversation_creator();

-- Public is the exposed API schema. Each table is private by default until the
-- exact client role grants and row policies below are installed.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'professional_categories', 'professional_profiles',
    'professional_category_links', 'professional_services', 'subscriptions',
    'posts', 'post_images', 'post_likes', 'post_comments', 'post_saves',
    'professional_follows', 'service_requests', 'service_request_images',
    'service_request_responses', 'conversations', 'conversation_members',
    'messages', 'reviews', 'notifications', 'reports'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
  end loop;
end;
$$;
alter table app_private.professional_verifications enable row level security;
revoke all on app_private.professional_verifications from public, anon, authenticated;

grant select on public.profiles, public.professional_categories,
  public.professional_profiles, public.professional_category_links,
  public.professional_services, public.subscriptions, public.posts,
  public.post_images, public.post_likes, public.post_comments,
  public.post_saves, public.professional_follows, public.service_requests,
  public.service_request_images, public.service_request_responses,
  public.conversations, public.conversation_members, public.messages,
  public.reviews, public.notifications, public.reports to authenticated;

grant update (display_name, avatar_path, city, postal_code, latitude, longitude, bio)
  on public.profiles to authenticated;
grant update (business_name, headline, description, cover_path, website_url,
  city, postal_code, latitude, longitude, service_radius_km)
  on public.professional_profiles to authenticated;
grant insert, delete on public.professional_category_links to authenticated;
grant insert, delete on public.professional_services to authenticated;
grant update (title, description, category_id, is_active) on public.professional_services to authenticated;
grant insert, delete on public.posts to authenticated;
grant update (body, category_id, city, visibility, in_portfolio, status) on public.posts to authenticated;
grant insert, delete on public.post_images, public.post_likes, public.post_comments,
  public.post_saves, public.professional_follows, public.service_requests,
  public.service_request_images, public.service_request_responses,
  public.conversations, public.conversation_members, public.messages,
  public.reviews, public.reports to authenticated;
grant update (body) on public.post_comments to authenticated;
grant update (title, description, category_id, city, postal_code,
  budget_min_cents, budget_max_cents, desired_by, status)
  on public.service_requests to authenticated;
grant update (message) on public.service_request_responses to authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;
grant update (rating, body) on public.reviews to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_edit_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy categories_read on public.professional_categories for select to authenticated using (true);
create policy professionals_read on public.professional_profiles for select to authenticated
  using (verification_status = 'verified' or user_id = (select auth.uid()));
create policy professionals_edit_self on public.professional_profiles for update to authenticated
  using (user_id = (select auth.uid()) and verification_status = 'verified')
  with check (user_id = (select auth.uid()) and verification_status = 'verified');
create policy category_links_read on public.professional_category_links for select to authenticated
  using (exists (select 1 from public.professional_profiles p where p.user_id = professional_id));
create policy category_links_add on public.professional_category_links for insert to authenticated
  with check (professional_id = (select auth.uid()) and exists (
    select 1 from public.professional_profiles p where p.user_id = professional_id and p.verification_status = 'verified'));
create policy category_links_remove on public.professional_category_links for delete to authenticated
  using (professional_id = (select auth.uid()));
create policy services_read on public.professional_services for select to authenticated
  using (professional_id = (select auth.uid()) or (is_active and exists (
    select 1 from public.professional_profiles p where p.user_id = professional_id and p.verification_status = 'verified')));
create policy services_add on public.professional_services for insert to authenticated
  with check (professional_id = (select auth.uid()) and exists (
    select 1 from public.professional_profiles p where p.user_id = professional_id and p.verification_status = 'verified'));
create policy services_edit on public.professional_services for update to authenticated
  using (professional_id = (select auth.uid())) with check (professional_id = (select auth.uid()));
create policy services_remove on public.professional_services for delete to authenticated
  using (professional_id = (select auth.uid()));
create policy subscriptions_read_self on public.subscriptions for select to authenticated
  using (professional_id = (select auth.uid()));

-- This checks both the immutable account role and server-maintained verification.
-- Paid plan gates can be added here later without changing account_type.
create or replace function app_private.can_publish_professionally()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.profiles a
    join public.professional_profiles p on p.user_id = a.id
    where a.id = (select auth.uid()) and a.account_type = 'professional'
      and p.verification_status = 'verified'
  );
$$;
revoke all on function app_private.can_publish_professionally() from public, anon, authenticated;
grant execute on function app_private.can_publish_professionally() to authenticated;

create policy posts_read on public.posts for select to authenticated using (
  author_id = (select auth.uid()) or (status = 'published' and (
    visibility = 'network' or (visibility = 'contacts' and exists (
      select 1 from public.professional_follows f
      where f.professional_id = author_id and f.follower_id = (select auth.uid())
    ))
  ))
);
create policy posts_add on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and (select app_private.can_publish_professionally()));
create policy posts_edit on public.posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and (select app_private.can_publish_professionally()));
create policy posts_remove on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));
create policy post_images_read on public.post_images for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_images_add on public.post_images for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
    and storage_path like (select auth.uid())::text || '/%');
create policy post_images_remove on public.post_images for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));
create policy post_likes_read on public.post_likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_likes_add on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy post_likes_remove on public.post_likes for delete to authenticated
  using (user_id = (select auth.uid()));
create policy post_comments_read on public.post_comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_comments_add on public.post_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy post_comments_edit on public.post_comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy post_comments_remove on public.post_comments for delete to authenticated
  using (author_id = (select auth.uid()));
create policy post_saves_read_self on public.post_saves for select to authenticated
  using (user_id = (select auth.uid()));
create policy post_saves_add on public.post_saves for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy post_saves_remove on public.post_saves for delete to authenticated
  using (user_id = (select auth.uid()));
create policy follows_read on public.professional_follows for select to authenticated using (true);
create policy follows_add on public.professional_follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and exists (
    select 1 from public.professional_profiles p where p.user_id = professional_id and p.verification_status = 'verified'));
create policy follows_remove on public.professional_follows for delete to authenticated
  using (follower_id = (select auth.uid()));

create policy requests_read on public.service_requests for select to authenticated
  using (customer_id = (select auth.uid()) or status in ('open', 'in_progress', 'closed'));
create policy requests_add on public.service_requests for insert to authenticated
  with check (customer_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = customer_id and p.account_type = 'customer'));
create policy requests_edit on public.service_requests for update to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));
create policy requests_remove on public.service_requests for delete to authenticated
  using (customer_id = (select auth.uid()));
create policy request_images_read on public.service_request_images for select to authenticated
  using (exists (select 1 from public.service_requests r where r.id = request_id));
create policy request_images_add on public.service_request_images for insert to authenticated
  with check (exists (select 1 from public.service_requests r where r.id = request_id and r.customer_id = (select auth.uid()))
    and storage_path like (select auth.uid())::text || '/%');
create policy request_images_remove on public.service_request_images for delete to authenticated
  using (exists (select 1 from public.service_requests r where r.id = request_id and r.customer_id = (select auth.uid())));
create policy responses_read on public.service_request_responses for select to authenticated
  using (professional_id = (select auth.uid()) or exists (
    select 1 from public.service_requests r where r.id = request_id and r.customer_id = (select auth.uid())));
create policy responses_add on public.service_request_responses for insert to authenticated
  with check (professional_id = (select auth.uid()) and (select app_private.can_publish_professionally())
    and exists (select 1 from public.service_requests r where r.id = request_id and r.status = 'open'));
create policy responses_edit on public.service_request_responses for update to authenticated
  using (professional_id = (select auth.uid())) with check (professional_id = (select auth.uid()));
create policy responses_remove on public.service_request_responses for delete to authenticated
  using (professional_id = (select auth.uid()));

create policy conversations_read on public.conversations for select to authenticated
  using (created_by = (select auth.uid()) or app_private.is_conversation_member(id));
create policy conversations_add on public.conversations for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy conversation_members_read on public.conversation_members for select to authenticated
  using (app_private.is_conversation_member(conversation_id));
create policy conversation_members_add on public.conversation_members for insert to authenticated
  with check (user_id <> (select auth.uid()) and app_private.can_add_conversation_member(conversation_id));
create policy conversation_members_read_time on public.conversation_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy messages_read on public.messages for select to authenticated
  using (app_private.is_conversation_member(conversation_id));
create policy messages_add on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and app_private.is_conversation_member(conversation_id));

create policy reviews_read on public.reviews for select to authenticated using (true);
create policy reviews_add on public.reviews for insert to authenticated
  with check (customer_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = customer_id and p.account_type = 'customer')
    and exists (select 1 from public.professional_profiles p where p.user_id = professional_id and p.verification_status = 'verified')
    and (request_id is null or exists (select 1 from public.service_requests r where r.id = request_id and r.customer_id = customer_id)));
create policy reviews_edit on public.reviews for update to authenticated
  using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));
create policy reviews_remove on public.reviews for delete to authenticated
  using (customer_id = (select auth.uid()));
create policy notifications_read_self on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy reports_read_self on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));
create policy reports_add on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- Private buckets still need per-object access rules; a URL alone grants nothing.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('covers', 'covers', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-images', 'post-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('request-images', 'request-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy artiz_avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy artiz_avatars_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy artiz_avatars_replace on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy artiz_avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy artiz_covers_read on storage.objects for select to authenticated
  using (bucket_id = 'covers' and (split_part(name, '/', 1) = (select auth.uid())::text or exists (
    select 1 from public.professional_profiles p where p.cover_path = name and p.verification_status = 'verified')));
create policy artiz_covers_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and split_part(name, '/', 1) = (select auth.uid())::text
    and (select app_private.can_publish_professionally()));
create policy artiz_covers_replace on storage.objects for update to authenticated
  using (bucket_id = 'covers' and split_part(name, '/', 1) = (select auth.uid())::text)
  with check (bucket_id = 'covers' and split_part(name, '/', 1) = (select auth.uid())::text
    and (select app_private.can_publish_professionally()));
create policy artiz_covers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy artiz_post_images_read on storage.objects for select to authenticated
  using (bucket_id = 'post-images' and (split_part(name, '/', 1) = (select auth.uid())::text or exists (
    select 1 from public.post_images i where i.storage_path = name)));
create policy artiz_post_images_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and split_part(name, '/', 1) = (select auth.uid())::text
    and (select app_private.can_publish_professionally()));
create policy artiz_post_images_replace on storage.objects for update to authenticated
  using (bucket_id = 'post-images' and split_part(name, '/', 1) = (select auth.uid())::text)
  with check (bucket_id = 'post-images' and split_part(name, '/', 1) = (select auth.uid())::text
    and (select app_private.can_publish_professionally()));
create policy artiz_post_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy artiz_request_images_read on storage.objects for select to authenticated
  using (bucket_id = 'request-images' and (split_part(name, '/', 1) = (select auth.uid())::text or exists (
    select 1 from public.service_request_images i where i.storage_path = name)));
create policy artiz_request_images_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'request-images' and split_part(name, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'customer'));
create policy artiz_request_images_replace on storage.objects for update to authenticated
  using (bucket_id = 'request-images' and split_part(name, '/', 1) = (select auth.uid())::text)
  with check (bucket_id = 'request-images' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy artiz_request_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'request-images' and split_part(name, '/', 1) = (select auth.uid())::text);
