-- Run as database owner. This fixture and all its messages are rolled back.
begin;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000701'), -- customer A
  ('00000000-0000-4000-8000-000000000702'); -- professional B
update public.profiles set account_type = 'professional'
where id = '00000000-0000-4000-8000-000000000702';
insert into public.professional_profiles (user_id, business_name, verification_status)
values ('00000000-0000-4000-8000-000000000702', 'Atelier test', 'verified');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000701', true);

do $$
declare thread_id uuid;
declare changed_rows integer;
begin
  thread_id := public.get_or_create_direct_conversation(
    '00000000-0000-4000-8000-000000000702', 'profile', null);
  insert into public.messages (conversation_id, sender_id, body)
  values (thread_id, auth.uid(), 'Premier message');

  update public.conversation_members set hidden_at = now()
  where conversation_id = thread_id and user_id = auth.uid();
  if exists (select 1 from public.list_my_direct_conversations() where id = thread_id) then
    raise exception 'A can still see a hidden conversation';
  end if;
  if exists (select 1 from public.unread_message_counts() where conversation_id = thread_id) then
    raise exception 'A still has an unread badge for a hidden conversation';
  end if;
  if (select hidden_at from public.conversation_members
      where conversation_id = thread_id
        and user_id = '00000000-0000-4000-8000-000000000702') is not null then
    raise exception 'A hid the conversation for B';
  end if;

  update public.conversation_members set hidden_at = now()
  where conversation_id = thread_id
    and user_id = '00000000-0000-4000-8000-000000000702';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then raise exception 'A changed B membership'; end if;

  begin
    update public.conversation_members set joined_at = now()
    where conversation_id = thread_id and user_id = auth.uid();
    raise exception 'A changed protected membership columns';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.messages where conversation_id = thread_id;
    raise exception 'A physically deleted messages';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000702', true);
do $$
declare thread_id uuid;
begin
  select id into thread_id from public.list_my_direct_conversations();
  if thread_id is null then raise exception 'B lost the conversation hidden by A'; end if;
  insert into public.messages (conversation_id, sender_id, body)
  values (thread_id, auth.uid(), 'Réponse de B');
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000701', true);
do $$
declare thread_id uuid;
begin
  select id into thread_id from public.list_my_direct_conversations();
  if thread_id is null then raise exception 'B reply did not restore thread for A'; end if;
  if (select count(*) from public.messages where conversation_id = thread_id) <> 2 then
    raise exception 'History was lost';
  end if;
  if public.get_or_create_direct_conversation(
      '00000000-0000-4000-8000-000000000702', 'quote', null) <> thread_id then
    raise exception 'New entrypoint created a duplicate thread';
  end if;
  if (select count(*) from public.conversations
      where least(created_by, recipient_id) = '00000000-0000-4000-8000-000000000701'::uuid
        and greatest(created_by, recipient_id) = '00000000-0000-4000-8000-000000000702'::uuid) <> 1 then
    raise exception 'More than one direct thread exists';
  end if;
end;
$$;

-- A sender who reopens a hidden thread also sees it in their own inbox.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000702', true);
update public.conversation_members set hidden_at = now() where user_id = auth.uid();
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000701', true);
do $$
declare thread_id uuid;
begin
  select id into thread_id from public.list_my_direct_conversations();
  insert into public.messages (conversation_id, sender_id, body)
  values (thread_id, auth.uid(), 'Nouveau message de A');
end;
$$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000702', true);
do $$
begin
  if (select count(*) from public.list_my_direct_conversations()) <> 1 then
    raise exception 'A new message did not restore thread for B';
  end if;
end;
$$;

select 'conversation_visibility_passed' as result;
rollback;
