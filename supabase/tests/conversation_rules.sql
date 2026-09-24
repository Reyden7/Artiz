-- Run as a database owner. All fixtures are rolled back.
begin;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000101'), -- customer A
  ('00000000-0000-4000-8000-000000000102'), -- customer B
  ('00000000-0000-4000-8000-000000000103'), -- professional A
  ('00000000-0000-4000-8000-000000000104'); -- professional B
update public.profiles set account_type = 'professional'
where id in ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104');
insert into public.professional_profiles (user_id, business_name, verification_status) values
  ('00000000-0000-4000-8000-000000000103', 'Atelier A', 'verified'),
  ('00000000-0000-4000-8000-000000000104', 'Atelier B', 'verified');
insert into public.service_requests (id, customer_id, title, description, city) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000102',
   'Travaux', 'Projet de rénovation', 'Annecy');
insert into public.service_request_responses (request_id, professional_id, message) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000103',
   'Je peux vous aider.');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);

do $$
declare direct_id uuid;
begin
  if app_private.can_create_conversation(
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102', 'profile', null
  ) then raise exception 'customer -> customer was allowed'; end if;
  if app_private.can_create_conversation(
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000103', 'profile', null
  ) then raise exception 'spoofed sender was allowed'; end if;
  begin
    insert into public.conversations (created_by, recipient_id, context) values
      ('00000000-0000-4000-8000-000000000101',
       '00000000-0000-4000-8000-000000000102', 'profile');
    raise exception 'customer -> customer INSERT was allowed';
  exception when insufficient_privilege then null;
  end;

  insert into public.conversations (created_by, recipient_id, context) values
    ('00000000-0000-4000-8000-000000000101',
     '00000000-0000-4000-8000-000000000103', 'profile') returning id into direct_id;
  if (select count(*) from public.conversation_members
      where conversation_id = direct_id) <> 2 then
    raise exception 'validated conversation did not receive exactly two members';
  end if;
  begin
    insert into public.conversation_members (conversation_id, user_id) values
      (direct_id, '00000000-0000-4000-8000-000000000102');
    raise exception 'direct member INSERT was allowed';
  exception when insufficient_privilege then null;
  end;
  insert into public.messages (conversation_id, sender_id, body) values
    (direct_id, '00000000-0000-4000-8000-000000000101', 'Bonjour');
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
do $$
declare request_conversation uuid;
begin
  if app_private.can_create_conversation(
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000102', 'profile', null
  ) then raise exception 'unsolicited professional -> customer was allowed'; end if;
  if app_private.can_create_conversation(
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000104', 'profile', null
  ) then raise exception 'professional -> professional was allowed'; end if;
  if not app_private.can_create_conversation(
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000101', 'reply', null
  ) then raise exception 'reply to prior customer contact was rejected'; end if;
  if not app_private.can_create_conversation(
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000102', 'request',
    '00000000-0000-4000-8000-000000000201'
  ) then raise exception 'response to a published request was rejected'; end if;
  begin
    insert into public.conversations (created_by, recipient_id, context) values
      ('00000000-0000-4000-8000-000000000103',
       '00000000-0000-4000-8000-000000000102', 'profile');
    raise exception 'unsolicited professional -> customer INSERT was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.conversations (created_by, recipient_id, context) values
      ('00000000-0000-4000-8000-000000000103',
       '00000000-0000-4000-8000-000000000104', 'profile');
    raise exception 'professional -> professional INSERT was allowed';
  exception when insufficient_privilege then null;
  end;

  insert into public.conversations (created_by, recipient_id, context, request_id) values
    ('00000000-0000-4000-8000-000000000103',
     '00000000-0000-4000-8000-000000000102', 'request',
     '00000000-0000-4000-8000-000000000201') returning id into request_conversation;
  if (select count(*) from public.conversation_members
      where conversation_id = request_conversation) <> 2 then
    raise exception 'request conversation did not receive exactly two members';
  end if;
  insert into public.messages (conversation_id, sender_id, body) values
    (request_conversation, '00000000-0000-4000-8000-000000000103', 'Bonjour');
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
do $$
declare request_conversation uuid;
begin
  select id into request_conversation from public.conversations
  where request_id = '00000000-0000-4000-8000-000000000201';
  insert into public.messages (conversation_id, sender_id, body) values
    (request_conversation, '00000000-0000-4000-8000-000000000102', 'Merci pour votre réponse');
end;
$$;

rollback;
