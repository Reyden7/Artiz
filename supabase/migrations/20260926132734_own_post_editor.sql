-- The Data API grants and existing posts_edit/posts_remove policies already
-- restrict writes to the author. Include the title in editable columns.
grant update (title) on public.posts to authenticated;

-- Keep the post and ordered image references in one database transaction.
-- Files must already exist in the owner's post folder; Storage cleanup follows
-- only after this transaction succeeds.
create function public.replace_own_post(
  target_post uuid, new_title text, new_body text, new_category uuid,
  new_city text, image_paths text[]
)
returns text[] language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := (select auth.uid());
declare prior_paths text[];
declare missing_count integer;
begin
  if owner_id is null or target_post is null
    or not coalesce((select app_private.can_publish_professionally()), false)
    or not exists (select 1 from public.posts p where p.id = target_post
      and p.author_id = owner_id and p.status = 'published') then
    raise exception 'Post update not allowed' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(new_title, ''))) not between 2 and 120
    or char_length(btrim(coalesce(new_body, ''))) not between 1 and 2000
    or char_length(btrim(coalesce(new_city, ''))) not between 1 and 120
    or new_category is null or not exists (
      select 1 from public.professional_categories cat where cat.id = new_category
    ) or coalesce(array_length(image_paths, 1), 0) not between 1 and 10
    or (select count(distinct path) from unnest(image_paths) path)
      <> array_length(image_paths, 1) then
    raise exception 'Invalid post fields' using errcode = '22023';
  end if;
  select count(*) into missing_count from unnest(image_paths) path
    where path is null
      or path not like owner_id::text || '/' || target_post::text || '/%.jpg'
      or not exists (select 1 from storage.objects obj
        where obj.bucket_id = 'post-images' and obj.name = path);
  if missing_count > 0 then
    raise exception 'Invalid post image' using errcode = '22023';
  end if;
  select coalesce(array_agg(storage_path order by position), '{}')
    into prior_paths from public.post_images where post_id = target_post;
  update public.posts set title = btrim(new_title), body = btrim(new_body),
    category_id = new_category, city = btrim(new_city) where id = target_post;
  delete from public.post_images where post_id = target_post;
  insert into public.post_images (post_id, storage_path, position)
    select target_post, path, (ordinality - 1)::smallint
    from unnest(image_paths) with ordinality as ordered(path, ordinality);
  return array(select unnest(prior_paths) except select unnest(image_paths));
end;
$$;
revoke all on function public.replace_own_post(uuid, text, text, uuid, text, text[])
  from public, anon;
grant execute on function public.replace_own_post(uuid, text, text, uuid, text, text[])
  to authenticated;
