-- Keep social counters on the post so a paginated feed does not load every reaction.
alter table public.posts add column like_count integer not null default 0 check (like_count >= 0);
alter table public.posts add column comment_count integer not null default 0 check (comment_count >= 0);
update public.posts p set
  like_count = (select count(*) from public.post_likes l where l.post_id = p.id),
  comment_count = (select count(*) from public.post_comments c where c.post_id = p.id);

create function app_private.update_post_reaction_count()
returns trigger language plpgsql security definer set search_path = '' as $$
declare affected_post uuid;
begin
  affected_post := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
  if tg_table_name = 'post_likes' then
    update public.posts set like_count = greatest(0, like_count + case when tg_op = 'INSERT' then 1 else -1 end)
      where id = affected_post;
  else
    update public.posts set comment_count = greatest(0, comment_count + case when tg_op = 'INSERT' then 1 else -1 end)
      where id = affected_post;
  end if;
  if tg_op = 'INSERT' then return new; end if;
  return old;
end;
$$;
revoke all on function app_private.update_post_reaction_count() from public, anon, authenticated;
create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function app_private.update_post_reaction_count();
create trigger post_comments_count after insert or delete on public.post_comments
  for each row execute function app_private.update_post_reaction_count();

-- An avatar must be uploaded under its owner's prefix before becoming public profile data.
drop policy profiles_edit_self on public.profiles;
create policy profiles_edit_self on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and (avatar_path is null or (
    avatar_path like id::text || '/%'
    and exists (select 1 from storage.objects o
      where o.bucket_id = 'avatars' and o.name = avatar_path))));
drop policy artiz_avatars_read on storage.objects;
create policy artiz_avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (
    split_part(name, '/', 1) = (select auth.uid())::text
    or exists (select 1 from public.profiles p where p.avatar_path = name)));

-- A review summary is read-only and respects the existing review visibility policy.
create function public.professional_review_summary(target_professional uuid)
returns table (review_count bigint, average_rating numeric)
language sql stable security invoker set search_path = '' as $$
  select count(*), coalesce(round(avg(r.rating)::numeric, 1), 0)
  from public.reviews r where r.professional_id = target_professional;
$$;
revoke all on function public.professional_review_summary(uuid) from public, anon;
grant execute on function public.professional_review_summary(uuid) to authenticated;

-- Mention positions count Unicode code points (Postgres char_length), not UTF-16 units.
create table public.comment_mentions (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  start_cp integer not null check (start_cp >= 0),
  length_cp integer not null check (length_cp between 2 and 101),
  label text not null check (char_length(label) between 2 and 101),
  created_at timestamptz not null default now(),
  primary key (comment_id, start_cp)
);
create index comment_mentions_target_idx on public.comment_mentions (mentioned_user_id, created_at desc);
alter table public.comment_mentions enable row level security;
revoke all on public.comment_mentions from public, anon, authenticated;
grant select on public.comment_mentions to authenticated;
create policy comment_mentions_read on public.comment_mentions for select to authenticated
  using (exists (select 1 from public.post_comments c where c.id = comment_id));

-- Suggestions include confirmed customers and verified professionals only.
create function public.search_mention_targets(search_term text, target_post uuid)
returns table (user_id uuid, display_name text, account_type text)
language plpgsql stable security definer set search_path = '' as $$
declare term text := trim(search_term);
declare actor_type text;
begin
  if (select auth.uid()) is null or target_post is null
    or char_length(term) < 2 or char_length(term) > 40 then
    return;
  end if;
  select p.account_type into actor_type from public.profiles p where p.id = (select auth.uid());
  return query
    select p.id, p.display_name, p.account_type
    from public.profiles p
    join auth.users u on u.id = p.id and u.email_confirmed_at is not null
    left join public.professional_profiles pro on pro.user_id = p.id
    where p.display_name <> ''
      and (p.account_type = 'customer'
        or (p.account_type = 'professional' and pro.verification_status = 'verified'))
      and (p.account_type <> 'customer' or actor_type = 'customer' or p.id = (select auth.uid())
        or exists (select 1 from public.post_comments c
          where c.post_id = target_post and c.author_id = p.id))
      and p.display_name ilike '%' || replace(replace(replace(term, chr(92), ''), '%', ''), '_', '') || '%'
    order by case when lower(p.display_name) = lower(term) then 0 else 1 end, p.display_name
    limit 8;
end;
$$;
revoke all on function public.search_mention_targets(text, uuid) from public, anon;
grant execute on function public.search_mention_targets(text, uuid) to authenticated;

-- All comment creation goes through this transaction so a mention can never be forged
-- by writing comment_mentions or notifications directly through the Data API.
revoke insert on public.post_comments from authenticated;
revoke update (body) on public.post_comments from authenticated;
drop policy post_comments_add on public.post_comments;
drop policy post_comments_edit on public.post_comments;

create function public.create_post_comment(target_post uuid, comment_body text, mentions jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  target public.posts%rowtype;
  created_id uuid;
  mention jsonb;
  mentioned_id uuid;
  mentioned_name text;
  actor_type text;
  mention_start integer;
  mention_length integer;
  previous_end integer := 0;
  mention_count integer;
begin
  if actor is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if comment_body is null or comment_body <> trim(comment_body)
    or char_length(comment_body) not between 1 and 1000 then
    raise exception 'Commentaire invalide' using errcode = '22023';
  end if;
  if jsonb_typeof(mentions) <> 'array' then
    raise exception 'Mentions invalides' using errcode = '22023';
  end if;
  mention_count := jsonb_array_length(mentions);
  if mention_count > 5 then raise exception 'Trop de mentions' using errcode = '22023'; end if;

  select * into target from public.posts where id = target_post;
  if not found or target.status <> 'published' or not (
    target.visibility = 'network' or target.author_id = actor or
    (target.visibility = 'contacts' and exists (
      select 1 from public.professional_follows f
      where f.professional_id = target.author_id and f.follower_id = actor))
  ) then raise exception 'Publication indisponible' using errcode = '42501'; end if;
  select account_type into actor_type from public.profiles where id = actor;

  if (select count(*) from public.post_comments
      where author_id = actor and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Patientez avant de commenter à nouveau' using errcode = '42901';
  end if;

  insert into public.post_comments (post_id, author_id, body)
  values (target_post, actor, comment_body) returning id into created_id;

  for mention in select value from jsonb_array_elements(mentions) loop
    if jsonb_typeof(mention) <> 'object'
      or coalesce(mention->>'user_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(mention->>'start_cp', '') !~ '^[0-9]{1,4}$'
      or coalesce(mention->>'length_cp', '') !~ '^[0-9]{1,3}$' then
      raise exception 'Mention invalide' using errcode = '22023';
    end if;
    mentioned_id := (mention->>'user_id')::uuid;
    mention_start := (mention->>'start_cp')::integer;
    mention_length := (mention->>'length_cp')::integer;
    if mention_start < previous_end or mention_length < 2 or mention_length > 101
      or mention_start + mention_length > char_length(comment_body) then
      raise exception 'Position de mention invalide' using errcode = '22023';
    end if;

    select p.display_name into mentioned_name
    from public.profiles p
    join auth.users u on u.id = p.id and u.email_confirmed_at is not null
    left join public.professional_profiles pro on pro.user_id = p.id
    where p.id = mentioned_id and p.display_name <> '' and (
      p.account_type = 'customer' or
      (p.account_type = 'professional' and pro.verification_status = 'verified'));
    if mentioned_name is null or mention_length <> char_length('@' || mentioned_name)
      or substring(comment_body from mention_start + 1 for mention_length) <> '@' || mentioned_name then
      raise exception 'Mention obsolète ou invalide' using errcode = '22023';
    end if;
    if actor_type <> 'customer' and mentioned_id <> actor
      and exists (select 1 from public.profiles p
        where p.id = mentioned_id and p.account_type = 'customer')
      and not exists (select 1 from public.post_comments c
        where c.post_id = target_post and c.author_id = mentioned_id and c.id <> created_id) then
      raise exception 'Ce particulier ne participe pas à cette discussion' using errcode = '42501';
    end if;

    insert into public.comment_mentions (comment_id, mentioned_user_id, start_cp, length_cp, label)
    values (created_id, mentioned_id, mention_start, mention_length, '@' || mentioned_name);
    if mentioned_id <> actor then
      insert into public.notifications (recipient_id, actor_id, kind, payload)
      values (mentioned_id, actor, 'comment_mention',
        jsonb_build_object('post_id', target_post, 'comment_id', created_id));
    end if;
    previous_end := mention_start + mention_length;
  end loop;
  return created_id;
end;
$$;
revoke all on function public.create_post_comment(uuid, text, jsonb) from public, anon;
grant execute on function public.create_post_comment(uuid, text, jsonb) to authenticated;

create function app_private.remove_deleted_comment_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications n
  where n.kind = 'comment_mention' and n.payload->>'comment_id' = old.id::text;
  return old;
end;
$$;
revoke all on function app_private.remove_deleted_comment_notifications() from public, anon, authenticated;
create trigger remove_deleted_comment_notifications before delete on public.post_comments
  for each row execute function app_private.remove_deleted_comment_notifications();
