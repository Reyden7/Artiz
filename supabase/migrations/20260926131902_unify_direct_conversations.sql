-- One direct thread per pair, independently of how contact began.
-- Keep request references on messages before merging request-bound threads.
alter table public.messages add column service_request_id uuid
  references public.service_requests(id) on delete set null;
create index messages_service_request_idx on public.messages(service_request_id)
  where service_request_id is not null;
update public.messages m set service_request_id = c.request_id
  from public.conversations c
  where c.id = m.conversation_id and c.request_id is not null;

lock table public.conversations in access exclusive mode;
do $$
declare duplicate record;
declare member record;
begin
  for duplicate in
    select id, canonical_id from (
      select id, first_value(id) over (
        partition by least(created_by, recipient_id), greatest(created_by, recipient_id)
        order by created_at, id
      ) canonical_id
      from public.conversations
    ) pairs where id <> canonical_id
  loop
    for member in select user_id, joined_at, last_read_at
      from public.conversation_members where conversation_id = duplicate.id
    loop
      update public.conversation_members cm
      set joined_at = least(cm.joined_at, member.joined_at),
        last_read_at = case when cm.last_read_at is null or member.last_read_at is null
          then null else least(cm.last_read_at, member.last_read_at) end
      where cm.conversation_id = duplicate.canonical_id and cm.user_id = member.user_id;
    end loop;
    update public.messages set conversation_id = duplicate.canonical_id
      where conversation_id = duplicate.id;
    update public.notifications
      set payload = jsonb_set(payload, '{conversation_id}', to_jsonb(duplicate.canonical_id::text))
      where payload->>'conversation_id' = duplicate.id::text;
    delete from public.conversations where id = duplicate.id;
  end loop;
end;
$$;
drop index public.conversations_direct_pair_unique;
drop index public.conversations_request_pair_unique;
create unique index conversations_one_pair_unique on public.conversations
  (least(created_by, recipient_id), greatest(created_by, recipient_id));

-- Existing legitimate contact permits replies in that same thread.
create or replace function app_private.can_create_conversation(
  sender_id uuid, target_id uuid, contact_context text, target_request_id uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select sender_id = (select auth.uid()) and sender_id <> target_id and (
    (app_private.is_customer(sender_id)
      and app_private.is_verified_professional(target_id)
      and ((target_request_id is null
          and contact_context in ('profile', 'post', 'search', 'quote'))
        or (target_request_id is not null
          and contact_context in ('quote', 'request')
          and exists (select 1 from public.service_requests r
            where r.id = target_request_id and r.customer_id = sender_id
              and r.recipient_id = target_id))))
    or
    (app_private.is_verified_professional(sender_id)
      and app_private.is_customer(target_id)
      and ((contact_context = 'request' and target_request_id is not null
        and exists (select 1 from public.service_requests r
          join public.service_request_responses response on response.request_id = r.id
          where r.id = target_request_id and r.customer_id = target_id
            and r.status in ('open', 'in_progress', 'closed')
            and response.professional_id = sender_id
            and response.status in ('sent', 'accepted')))
        or (contact_context = 'reply' and target_request_id is null
          and exists (select 1 from public.conversations previous
            where least(previous.created_by, previous.recipient_id) = least(sender_id, target_id)
              and greatest(previous.created_by, previous.recipient_id) = greatest(sender_id, target_id)))))
  );
$$;

-- Only this RPC may create a direct thread. Its permission check runs against
-- the database account types, verification state, request, and prior contact.
create function public.get_or_create_direct_conversation(
  target_id uuid, contact_context text, target_request_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sender_id uuid := (select auth.uid());
declare thread_id uuid;
begin
  if sender_id is null or target_id is null or
    not coalesce(app_private.can_create_conversation(
      sender_id, target_id, contact_context, target_request_id), false) then
    raise exception 'Conversation not allowed' using errcode = '42501';
  end if;
  select c.id into thread_id from public.conversations c
    where least(c.created_by, c.recipient_id) = least(sender_id, target_id)
      and greatest(c.created_by, c.recipient_id) = greatest(sender_id, target_id);
  if thread_id is not null then return thread_id; end if;
  insert into public.conversations (created_by, recipient_id, context, request_id)
    values (sender_id, target_id, contact_context, target_request_id)
    on conflict do nothing returning id into thread_id;
  if thread_id is null then
    select c.id into thread_id from public.conversations c
      where least(c.created_by, c.recipient_id) = least(sender_id, target_id)
        and greatest(c.created_by, c.recipient_id) = greatest(sender_id, target_id);
  end if;
  if thread_id is null then raise exception 'Conversation unavailable'; end if;
  return thread_id;
end;
$$;
revoke all on function public.get_or_create_direct_conversation(uuid, text, uuid)
  from public, anon;
grant execute on function public.get_or_create_direct_conversation(uuid, text, uuid)
  to authenticated;
revoke insert on public.conversations from authenticated;
drop policy conversations_add on public.conversations;

-- A message can refer only to a request belonging to this same customer/pro pair.
create function app_private.valid_message_request_context(
  target_conversation uuid, target_request uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_request is null or exists (
    select 1 from public.conversations c
    join public.service_requests r on r.id = target_request
    where c.id = target_conversation
      and (c.created_by = r.customer_id or c.recipient_id = r.customer_id)
      and (
        (r.recipient_id is not null
          and (c.created_by = r.recipient_id or c.recipient_id = r.recipient_id))
        or (r.recipient_id is null and exists (
          select 1 from public.service_request_responses response
          where response.request_id = r.id
            and response.professional_id in (c.created_by, c.recipient_id)
            and response.status in ('sent', 'accepted')))
      )
  );
$$;
revoke all on function app_private.valid_message_request_context(uuid, uuid)
  from public, anon;
grant execute on function app_private.valid_message_request_context(uuid, uuid)
  to authenticated;
drop policy messages_add on public.messages;
create policy messages_add on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid())
    and app_private.can_send_in_conversation(conversation_id)
    and app_private.valid_message_request_context(conversation_id, service_request_id));

-- The inbox uses the last actual message and sorts by activity.
create function public.list_my_direct_conversations()
returns table (
  id uuid, peer_id uuid, peer_name text, created_at timestamptz,
  last_message_body text, last_message_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select c.id,
    case when c.created_by = (select auth.uid()) then c.recipient_id else c.created_by end,
    coalesce(nullif(p.display_name, ''), 'Membre Artiz'),
    c.created_at, latest.body, latest.created_at
  from public.conversations c
  join public.conversation_members member
    on member.conversation_id = c.id and member.user_id = (select auth.uid())
  join public.profiles p on p.id =
    case when c.created_by = (select auth.uid()) then c.recipient_id else c.created_by end
  left join lateral (
    select m.body, m.created_at from public.messages m
    where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1
  ) latest on true
  order by coalesce(latest.created_at, c.created_at) desc, c.id;
$$;
revoke all on function public.list_my_direct_conversations() from public, anon;
grant execute on function public.list_my_direct_conversations() to authenticated;
