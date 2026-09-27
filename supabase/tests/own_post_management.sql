-- Run as database owner. Metadata-only Storage fixtures and posts roll back.
begin;
insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000961'),
  ('00000000-0000-4000-8000-000000000962'),
  ('00000000-0000-4000-8000-000000000963');
update public.profiles set account_type = 'professional'
  where id in ('00000000-0000-4000-8000-000000000961',
               '00000000-0000-4000-8000-000000000962');
insert into public.professional_profiles (user_id,business_name,verification_status) values
  ('00000000-0000-4000-8000-000000000961','Atelier de test A','verified'),
  ('00000000-0000-4000-8000-000000000962','Atelier de test B','verified');
insert into public.posts (id,author_id,title,body,category_id,city,status)
  select '00000000-0000-4000-8000-000000000964',
    '00000000-0000-4000-8000-000000000961',
    'Ancien titre','Ancien texte',id,'Annecy','published'
  from public.professional_categories order by name limit 1;
insert into storage.objects (bucket_id,name) values
  ('post-images','00000000-0000-4000-8000-000000000961/00000000-0000-4000-8000-000000000964/0.jpg'),
  ('post-images','00000000-0000-4000-8000-000000000961/00000000-0000-4000-8000-000000000964/new.jpg');
insert into public.post_images (post_id,storage_path,position) values
  ('00000000-0000-4000-8000-000000000964',
   '00000000-0000-4000-8000-000000000961/00000000-0000-4000-8000-000000000964/0.jpg',0);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000962',true);
do $$ begin
  begin
    perform public.replace_own_post('00000000-0000-4000-8000-000000000964',
      'Falsifié','Texte falsifié',(select id from public.professional_categories limit 1),
      'Lyon',array['00000000-0000-4000-8000-000000000961/00000000-0000-4000-8000-000000000964/0.jpg']);
    raise exception 'Another professional edited the post';
  exception when insufficient_privilege then null;
  end;
  delete from public.posts where id = '00000000-0000-4000-8000-000000000964';
  if found then raise exception 'Another professional deleted the post'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000963',true);
do $$ begin
  begin
    perform public.replace_own_post('00000000-0000-4000-8000-000000000964',
      'Falsifié','Texte falsifié',(select id from public.professional_categories limit 1),
      'Lyon',array['00000000-0000-4000-8000-000000000961/00000000-0000-4000-8000-000000000964/0.jpg']);
    raise exception 'Customer edited professional post';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000961',true);
do $$
declare unused text[];
begin
  unused := public.replace_own_post('00000000-0000-4000-8000-000000000964',
    'Nouveau titre','Nouvelle description',(select id from public.professional_categories limit 1),
    'Lyon',array['00000000-0000-4000-8000-000000000961/00000000-0000-4000-8000-000000000964/new.jpg']);
  if array_length(unused,1) <> 1
    or unused[1] <> '00000000-0000-4000-8000-000000000961/00000000-0000-4000-8000-000000000964/0.jpg'
    or (select title from public.posts where id='00000000-0000-4000-8000-000000000964') <> 'Nouveau titre'
    or (select count(*) from public.post_images where post_id='00000000-0000-4000-8000-000000000964') <> 1 then
    raise exception 'Owner post edit did not update fields and photos atomically';
  end if;
  begin
    perform public.replace_own_post('00000000-0000-4000-8000-000000000964',
      'Mauvais','Texte',(select id from public.professional_categories limit 1),
      'Lyon',array['00000000-0000-4000-8000-000000000962/another-post/photo.jpg']);
    raise exception 'Foreign image path accepted';
  exception when invalid_parameter_value then null;
  end;
  delete from public.posts where id='00000000-0000-4000-8000-000000000964';
  if not found then raise exception 'Owner could not delete the post'; end if;
end $$;
rollback;
