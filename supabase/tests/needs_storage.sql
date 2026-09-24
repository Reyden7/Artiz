-- Direct access checks for customer needs. The transaction leaves no records.
begin;
insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000901'),
  ('00000000-0000-4000-8000-000000000902'),
  ('00000000-0000-4000-8000-000000000903'),
  ('00000000-0000-4000-8000-000000000905');
update public.profiles set account_type = 'professional'
  where id in ('00000000-0000-4000-8000-000000000902',
               '00000000-0000-4000-8000-000000000903');
insert into public.professional_profiles (user_id, business_name, verification_status) values
  ('00000000-0000-4000-8000-000000000902', 'Atelier validé', 'verified'),
  ('00000000-0000-4000-8000-000000000903', 'Atelier en attente', 'pending');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000901', true);
insert into public.service_requests (id, customer_id, title, description, city, visibility, status)
values ('00000000-0000-4000-8000-000000000904',
        '00000000-0000-4000-8000-000000000901',
        'Bibliothèque sur mesure', 'Projet de bibliothèque dans le salon', 'Annecy', 'public', 'draft');
insert into storage.objects (bucket_id, name)
values ('request-images', '00000000-0000-4000-8000-000000000901/00000000-0000-4000-8000-000000000904/0.jpg');
insert into public.service_request_images (request_id, storage_path, position)
values ('00000000-0000-4000-8000-000000000904',
        '00000000-0000-4000-8000-000000000901/00000000-0000-4000-8000-000000000904/0.jpg', 0);
update public.service_requests set status = 'open'
  where id = '00000000-0000-4000-8000-000000000904';

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000903', true);
do $$ begin
  if exists (select 1 from public.service_requests
      where id = '00000000-0000-4000-8000-000000000904') then
    raise exception 'pending professional read a customer project';
  end if;
  begin
    insert into public.service_requests (customer_id, title, description, city)
    values ('00000000-0000-4000-8000-000000000903',
            'Faux besoin', 'Demande créée comme professionnel', 'Annecy');
    raise exception 'professional posted a customer need';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name)
      values ('request-images', '00000000-0000-4000-8000-000000000903/forbidden.jpg');
    raise exception 'professional uploaded a customer project photo';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.service_request_responses (request_id, professional_id, message)
    values ('00000000-0000-4000-8000-000000000904',
            '00000000-0000-4000-8000-000000000903', 'Réponse prématurée');
    raise exception 'pending professional answered a need';
  exception when insufficient_privilege then null;
  end;
end; $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000905', true);
do $$ begin
  if exists (select 1 from public.service_requests
      where id = '00000000-0000-4000-8000-000000000904') then
    raise exception 'another customer read a customer project';
  end if;
end; $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000902', true);
do $$ begin
  if not exists (select 1 from public.service_requests
      where id = '00000000-0000-4000-8000-000000000904') then
    raise exception 'verified professional cannot read public need';
  end if;
end; $$;
insert into public.service_request_responses (request_id, professional_id, message)
values ('00000000-0000-4000-8000-000000000904',
        '00000000-0000-4000-8000-000000000902', 'Je peux réaliser ce projet.');
rollback;
