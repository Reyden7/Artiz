-- Direct event and permission checks. No remote push is sent; fixtures roll back.
begin;
insert into auth.users (id, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000931', now()),
  ('00000000-0000-4000-8000-000000000932', now()),
  ('00000000-0000-4000-8000-000000000933', now());
update public.profiles set account_type = 'professional'
  where id = '00000000-0000-4000-8000-000000000932';
insert into app_private.admin_members (user_id)
  values ('00000000-0000-4000-8000-000000000933');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000931', true);
select public.register_push_token('ExpoPushToken[testCustomer931]', 'android');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000932', true);
select public.register_push_token('ExpoPushToken[testProfessional932]', 'android');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000933', true);
select public.register_push_token('ExpoPushToken[testAdmin933]', 'android');
do $$ begin
  if has_table_privilege('authenticated', 'public.notifications', 'INSERT')
    or has_table_privilege('authenticated', 'public.push_tokens', 'INSERT')
    or has_table_privilege('authenticated', 'app_private.push_deliveries', 'SELECT')
    or has_function_privilege('authenticated', 'public.claim_push_delivery(uuid)', 'EXECUTE') then
    raise exception 'client can forge a notification or access push delivery';
  end if;
end; $$;

reset role;
insert into public.professional_profiles (user_id, business_name, verification_status)
  values ('00000000-0000-4000-8000-000000000932', 'Atelier Notifications', 'pending');
do $$ begin
  if (select count(*) from public.notifications where recipient_id = '00000000-0000-4000-8000-000000000933'
      and kind = 'professional_pending') <> 1 then
    raise exception 'admin did not receive pending professional notification';
  end if;
  if (select count(*) from app_private.push_deliveries d join public.notifications n on n.id = d.notification_id
      where n.recipient_id = '00000000-0000-4000-8000-000000000933') <> 1 then
    raise exception 'admin push was not queued';
  end if;
end; $$;
update public.professional_profiles set verification_status = 'verified'
  where user_id = '00000000-0000-4000-8000-000000000932';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000931', true);
insert into public.conversations (id, created_by, recipient_id, context) values
  ('00000000-0000-4000-8000-000000000939', '00000000-0000-4000-8000-000000000931',
   '00000000-0000-4000-8000-000000000932', 'profile');
insert into public.messages (conversation_id, sender_id, body) values
  ('00000000-0000-4000-8000-000000000939', '00000000-0000-4000-8000-000000000931', 'Bonjour');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000932', true);
insert into public.messages (conversation_id, sender_id, body) values
  ('00000000-0000-4000-8000-000000000939', '00000000-0000-4000-8000-000000000932', 'Bonjour à vous');
reset role;
do $$ begin
  if (select count(*) from public.notifications where recipient_id = '00000000-0000-4000-8000-000000000932'
      and kind = 'new_message') <> 1 then
    raise exception 'professional did not receive customer message';
  end if;
  if (select count(*) from public.notifications where recipient_id = '00000000-0000-4000-8000-000000000931'
      and kind = 'new_message') <> 1 then
    raise exception 'customer did not receive professional reply';
  end if;
  if (select count(*) from app_private.push_deliveries d join public.notifications n on n.id = d.notification_id
      where n.kind = 'new_message') <> 2 then
    raise exception 'message push deliveries were not queued';
  end if;
end; $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000932', true);
update public.notification_preferences set new_messages = false
  where user_id = '00000000-0000-4000-8000-000000000932';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000931', true);
insert into public.messages (conversation_id, sender_id, body) values
  ('00000000-0000-4000-8000-000000000939', '00000000-0000-4000-8000-000000000931', 'Encore une question');
insert into public.service_requests (id, customer_id, title, description, city) values
  ('00000000-0000-4000-8000-000000000938', '00000000-0000-4000-8000-000000000931',
   'Projet de test', 'Besoin pour vérifier la réponse et sa notification.', 'Annecy');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000932', true);
insert into public.service_request_responses (request_id, professional_id, message) values
  ('00000000-0000-4000-8000-000000000938', '00000000-0000-4000-8000-000000000932',
   'Je peux vous aider sur ce projet.');
reset role;
do $$ begin
  if (select count(*) from public.notifications where recipient_id = '00000000-0000-4000-8000-000000000932'
      and kind = 'new_message') <> 2 then
    raise exception 'disabled push preference incorrectly suppressed internal message';
  end if;
  if (select count(*) from app_private.push_deliveries d join public.notifications n on n.id = d.notification_id
      where n.recipient_id = '00000000-0000-4000-8000-000000000932') <> 1 then
    raise exception 'disabled message preference still queued a push';
  end if;
  if (select count(*) from public.notifications where recipient_id = '00000000-0000-4000-8000-000000000931'
      and kind = 'request_response') <> 1 then
    raise exception 'request response did not create notification';
  end if;
end; $$;
rollback;
