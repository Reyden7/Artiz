-- Run as database owner. All fixtures are rolled back.
begin;
insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000901'),
  ('00000000-0000-4000-8000-000000000902'),
  ('00000000-0000-4000-8000-000000000903');
update public.profiles set account_type = 'professional'
  where id = '00000000-0000-4000-8000-000000000902';
insert into public.professional_profiles (user_id, business_name, verification_status)
  values ('00000000-0000-4000-8000-000000000902', 'Atelier de test', 'verified');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000901', true);
insert into public.conversations (id, created_by, recipient_id, context)
  values ('00000000-0000-4000-8000-000000000910',
    '00000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000902', 'profile');
insert into public.messages (conversation_id, sender_id, body)
  values (
    '00000000-0000-4000-8000-000000000910',
    '00000000-0000-4000-8000-000000000901', 'Bonjour');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000902', true);
insert into public.messages (conversation_id, sender_id, body)
  values (
    '00000000-0000-4000-8000-000000000910',
    '00000000-0000-4000-8000-000000000902', 'Bonjour à vous');

-- Fixture timestamps differ because now() is transaction-stable.
reset role;
update public.messages set created_at = now() + interval '1 second'
  where body = 'Bonjour' and conversation_id = '00000000-0000-4000-8000-000000000910';
update public.messages set created_at = now() + interval '2 seconds'
  where body = 'Bonjour à vous' and conversation_id = '00000000-0000-4000-8000-000000000910';
set local role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000901', true);
do $$ begin
  if (select unread_count from public.unread_message_counts()
      where conversation_id = '00000000-0000-4000-8000-000000000910') <> 1 then
    raise exception 'incoming message was not counted as unread';
  end if;
end; $$;
select public.mark_conversation_read(
  '00000000-0000-4000-8000-000000000910',
  (select id from public.messages where body = 'Bonjour à vous'
    and conversation_id = '00000000-0000-4000-8000-000000000910'));
do $$ begin
  if (select unread_count from public.unread_message_counts()
      where conversation_id = '00000000-0000-4000-8000-000000000910') <> 0 then
    raise exception 'read message is still counted';
  end if;
  if has_column_privilege('authenticated', 'public.conversation_members', 'last_read_at', 'UPDATE') then
    raise exception 'direct read cursor update is still allowed';
  end if;
  if has_column_privilege('authenticated', 'public.messages', 'created_at', 'INSERT') then
    raise exception 'client can forge message timestamps';
  end if;
end; $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000903', true);
do $$ begin
  if exists (select 1 from public.unread_message_counts()) then
    raise exception 'outsider saw unread counts';
  end if;
  begin
    perform public.mark_conversation_read(
      '00000000-0000-4000-8000-000000000910',
      (select id from public.messages where body = 'Bonjour à vous'
        and conversation_id = '00000000-0000-4000-8000-000000000910'));
    raise exception 'outsider marked a conversation read';
  exception when invalid_parameter_value or insufficient_privilege then null;
  end;
end; $$;
rollback;
