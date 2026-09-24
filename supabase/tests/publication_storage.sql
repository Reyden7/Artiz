-- Direct RLS checks for publications and image paths. No data survives ROLLBACK.
begin;
insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000801'),
  ('00000000-0000-4000-8000-000000000802'),
  ('00000000-0000-4000-8000-000000000803');
update public.profiles set account_type = 'professional'
  where id in ('00000000-0000-4000-8000-000000000802',
               '00000000-0000-4000-8000-000000000803');
insert into public.professional_profiles (user_id, business_name, verification_status) values
  ('00000000-0000-4000-8000-000000000802', 'Atelier vérifié', 'verified'),
  ('00000000-0000-4000-8000-000000000803', 'Atelier en attente', 'pending');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
do $$ begin
  begin
    insert into storage.objects (bucket_id, name)
      values ('post-images', '00000000-0000-4000-8000-000000000801/forbidden.jpg');
    raise exception 'customer uploaded a professional photo';
  exception when insufficient_privilege then null;
  end;
end; $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000803', true);
do $$ begin
  begin
    insert into storage.objects (bucket_id, name)
      values ('post-images', '00000000-0000-4000-8000-000000000803/forbidden.jpg');
    raise exception 'pending professional uploaded a photo';
  exception when insufficient_privilege then null;
  end;
end; $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000802', true);
insert into public.posts (id, author_id, title, body, status)
values ('00000000-0000-4000-8000-000000000804',
        '00000000-0000-4000-8000-000000000802', 'Terrasse en bois', 'Réalisation locale', 'draft');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name)
      values ('post-images', '00000000-0000-4000-8000-000000000801/foreign.jpg');
    raise exception 'professional uploaded into another account folder';
  exception when insufficient_privilege then null;
  end;
end; $$;
insert into storage.objects (bucket_id, name)
values ('post-images', '00000000-0000-4000-8000-000000000802/00000000-0000-4000-8000-000000000804/0.jpg');
insert into public.post_images (post_id, storage_path, position)
values ('00000000-0000-4000-8000-000000000804',
        '00000000-0000-4000-8000-000000000802/00000000-0000-4000-8000-000000000804/0.jpg', 0);
update public.posts set status = 'published'
  where id = '00000000-0000-4000-8000-000000000804';

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
do $$ begin
  if not exists (select 1 from public.posts
      where id = '00000000-0000-4000-8000-000000000804') then
    raise exception 'published work is absent from customer feed';
  end if;
end; $$;
reset role;
update public.professional_profiles set verification_status = 'rejected'
  where user_id = '00000000-0000-4000-8000-000000000802';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
do $$ begin
  if exists (select 1 from public.posts
      where id = '00000000-0000-4000-8000-000000000804') then
    raise exception 'rejected professional remained in feed';
  end if;
end; $$;
rollback;
