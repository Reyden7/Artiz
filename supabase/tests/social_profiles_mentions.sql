-- Direct API/RLS bypass checks. All fixtures and notifications are rolled back.
begin;
insert into auth.users (id, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000a01', now()),
  ('00000000-0000-4000-8000-000000000a02', now()),
  ('00000000-0000-4000-8000-000000000a03', now());
update public.profiles set display_name = 'Alice' where id = '00000000-0000-4000-8000-000000000a01';
update public.profiles set display_name = 'Bob' where id = '00000000-0000-4000-8000-000000000a02';
update public.profiles set display_name = 'Artisan Test', account_type = 'professional'
where id = '00000000-0000-4000-8000-000000000a03';
insert into public.professional_profiles (user_id, business_name, verification_status)
values ('00000000-0000-4000-8000-000000000a03', 'Atelier Test', 'verified');
insert into public.posts (id, author_id, title, body, status, visibility)
values ('00000000-0000-4000-8000-000000000a04',
        '00000000-0000-4000-8000-000000000a03', 'Projet visible', 'Projet visible', 'published', 'network');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000a01', true);
do $$ declare exposed boolean := false; begin
  begin
    perform latitude from public.profiles where id = '00000000-0000-4000-8000-000000000a02';
    exposed := true;
  exception when insufficient_privilege or undefined_column then null; end;
  if exposed then raise exception 'Exact customer coordinates remained public'; end if;
  exposed := false;
  begin
    perform longitude from public.professional_profiles where user_id = '00000000-0000-4000-8000-000000000a03';
    exposed := true;
  exception when insufficient_privilege or undefined_column then null; end;
  if exposed then raise exception 'Exact professional coordinates remained public'; end if;
end $$;
do $$ declare allowed boolean := false; begin
  begin
    update public.profiles set avatar_path = '00000000-0000-4000-8000-000000000a02/other.jpg'
    where id = '00000000-0000-4000-8000-000000000a01';
    allowed := true;
  exception when insufficient_privilege or check_violation then null; end;
  if allowed then raise exception 'Avatar path of another account was accepted'; end if;
end $$;
insert into storage.objects (bucket_id, name)
values ('avatars', '00000000-0000-4000-8000-000000000a01/avatar.jpg');
update public.profiles set avatar_path = '00000000-0000-4000-8000-000000000a01/avatar.jpg'
where id = '00000000-0000-4000-8000-000000000a01';
do $$ begin
  if not exists (select 1 from public.profiles
    where id = '00000000-0000-4000-8000-000000000a01'
      and avatar_path = '00000000-0000-4000-8000-000000000a01/avatar.jpg') then
    raise exception 'Owner could not attach uploaded avatar'; end if;
end $$;

insert into public.post_likes (post_id, user_id)
values ('00000000-0000-4000-8000-000000000a04', '00000000-0000-4000-8000-000000000a01');
do $$ declare accepted boolean := false; begin
  begin
    update public.posts set like_count = 999 where id = '00000000-0000-4000-8000-000000000a04';
    accepted := true;
  exception when insufficient_privilege then null; end;
  if accepted then raise exception 'Client could forge a like counter'; end if;
end $$;
insert into public.reviews (customer_id, professional_id, rating, body)
values ('00000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-000000000a03', 4, 'Travail soigné');
do $$ declare accepted boolean := false; begin
  begin
    insert into public.reviews (customer_id, professional_id, rating, body)
    values ('00000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-000000000a03', 5, 'Deuxième avis sans demande');
    accepted := true;
  exception when unique_violation then null; end;
  if accepted then raise exception 'Repeated review inflated the public rating'; end if;
end $$;
do $$ begin
  if not exists (select 1 from public.professional_review_summary('00000000-0000-4000-8000-000000000a03')
    where review_count = 1 and average_rating = 4.0) then
    raise exception 'Professional review summary incorrect'; end if;
end $$;
insert into public.reports (reporter_id, target_post_id, reason)
values ('00000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-000000000a04', 'Publication à vérifier');
do $$ declare accepted boolean := false; begin
  begin
    insert into public.reports (reporter_id, target_post_id, reason)
    values ('00000000-0000-4000-8000-000000000a02', '00000000-0000-4000-8000-000000000a04', 'Usurpation de signalement');
    accepted := true;
  exception when insufficient_privilege then null; end;
  if accepted then raise exception 'A user spoofed another reporter'; end if;
end $$;
do $$ begin
  if (select like_count from public.posts where id = '00000000-0000-4000-8000-000000000a04') <> 1 then
    raise exception 'Like counter was not incremented'; end if;
end $$;
delete from public.post_likes where post_id = '00000000-0000-4000-8000-000000000a04';
do $$ begin
  if (select like_count from public.posts where id = '00000000-0000-4000-8000-000000000a04') <> 0 then
    raise exception 'Like counter was not decremented'; end if;
end $$;

do $$ declare accepted boolean := false; begin
  begin
    insert into public.post_comments (post_id, author_id, body)
    values ('00000000-0000-4000-8000-000000000a04',
            '00000000-0000-4000-8000-000000000a01', 'Direct bypass');
    accepted := true;
  exception when insufficient_privilege then null; end;
  if accepted then raise exception 'Direct comment insert bypassed mention validation'; end if;
end $$;

select public.create_post_comment('00000000-0000-4000-8000-000000000a04',
  'Salut @Bob',
  '[{"user_id":"00000000-0000-4000-8000-000000000a02","start_cp":6,"length_cp":4}]'::jsonb);
do $$ declare emoji_comment uuid; begin
  emoji_comment := public.create_post_comment('00000000-0000-4000-8000-000000000a04',
    'Salut 👋 @Bob',
    '[{"user_id":"00000000-0000-4000-8000-000000000a02","start_cp":8,"length_cp":4}]'::jsonb);
  if not exists (select 1 from public.comment_mentions where comment_id = emoji_comment and start_cp = 8) then
    raise exception 'Unicode mention offset was not preserved'; end if;
  delete from public.post_comments where id = emoji_comment;
end $$;
do $$ declare accepted boolean := false; begin
  begin
    perform public.create_post_comment('00000000-0000-4000-8000-000000000a04',
      'Salut @Bob',
      '[{"user_id":"00000000-0000-4000-8000-000000000a02","start_cp":0,"length_cp":4}]'::jsonb);
    accepted := true;
  exception when invalid_parameter_value then null; end;
  if accepted then raise exception 'Forged mention offset was accepted'; end if;
end $$;
set local role postgres;
do $$ begin
  if (select comment_count from public.posts where id = '00000000-0000-4000-8000-000000000a04') <> 1
    or not exists (select 1 from public.comment_mentions
      where mentioned_user_id = '00000000-0000-4000-8000-000000000a02')
    or not exists (select 1 from public.notifications
      where recipient_id = '00000000-0000-4000-8000-000000000a02' and kind = 'comment_mention')
    or exists (select 1 from public.conversations
      where created_by in ('00000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-000000000a02', '00000000-0000-4000-8000-000000000a03')) then
    raise exception 'A mention did not create only its permitted public effects'; end if;
end $$;
set local role authenticated;

do $$ declare accepted boolean := false; begin
  begin
    insert into public.comment_mentions (comment_id, mentioned_user_id, start_cp, length_cp, label)
    select id, '00000000-0000-4000-8000-000000000a03', 0, 4, '@Bob'
    from public.post_comments where author_id = '00000000-0000-4000-8000-000000000a01' limit 1;
    accepted := true;
  exception when insufficient_privilege then null; end;
  if accepted then raise exception 'Direct mention insert was accepted'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000a03', true);
do $$ begin
  if exists (select 1 from public.search_mention_targets('Bob', '00000000-0000-4000-8000-000000000a04')
    where user_id = '00000000-0000-4000-8000-000000000a02') then
    raise exception 'Professional could discover a cold customer mention'; end if;
end $$;
do $$ declare accepted boolean := false; begin
  begin
    perform public.create_post_comment('00000000-0000-4000-8000-000000000a04',
      'Bonjour @Bob',
      '[{"user_id":"00000000-0000-4000-8000-000000000a02","start_cp":8,"length_cp":4}]'::jsonb);
    accepted := true;
  exception when insufficient_privilege then null; end;
  if accepted then raise exception 'Professional cold-mentioned a customer'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000a02', true);
select public.create_post_comment('00000000-0000-4000-8000-000000000a04', 'Je participe', '[]'::jsonb);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000a03', true);
do $$ begin
  if not exists (select 1 from public.search_mention_targets('Bob', '00000000-0000-4000-8000-000000000a04')
    where user_id = '00000000-0000-4000-8000-000000000a02') then
    raise exception 'Professional could not mention a customer participating in the post'; end if;
end $$;
select public.create_post_comment('00000000-0000-4000-8000-000000000a04',
  'Bonjour @Bob',
  '[{"user_id":"00000000-0000-4000-8000-000000000a02","start_cp":8,"length_cp":4}]'::jsonb);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000a02', true);
do $$ declare accepted boolean := false; begin
  begin
    update public.post_comments set body = 'Altered' where author_id = '00000000-0000-4000-8000-000000000a02';
    accepted := true;
  exception when insufficient_privilege then null; end;
  if accepted then raise exception 'Direct edit bypassed mention validation'; end if;
end $$;
do $$ begin
  if exists (select 1 from public.post_comments
    where author_id = '00000000-0000-4000-8000-000000000a01') then
    delete from public.post_comments where author_id = '00000000-0000-4000-8000-000000000a01';
    if not exists (select 1 from public.post_comments
      where author_id = '00000000-0000-4000-8000-000000000a01') then
      raise exception 'Another account deleted Alice''s comment'; end if;
  end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000a01', true);
delete from public.post_comments where author_id = '00000000-0000-4000-8000-000000000a01';
do $$ begin
  if exists (select 1 from public.comment_mentions
      where mentioned_user_id = '00000000-0000-4000-8000-000000000a02'
        and comment_id not in (select id from public.post_comments))
    or (select comment_count from public.posts where id = '00000000-0000-4000-8000-000000000a04') <> 2 then
    raise exception 'Deleting own comment left invalid relations or count'; end if;
end $$;
rollback;
