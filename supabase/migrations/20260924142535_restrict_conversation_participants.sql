-- Conversation participants are chosen at creation time and validated by one
-- database rule. Clients cannot add a second member after the fact.
alter table public.conversations
  add column recipient_id uuid not null references public.profiles(id) on delete cascade,
  add column context text not null check (context in ('profile', 'post', 'search', 'quote', 'request', 'reply')),
  add constraint conversations_distinct_participants check (created_by <> recipient_id);
create index conversations_recipient_idx on public.conversations(recipient_id);
create unique index conversations_direct_pair_unique on public.conversations
  (least(created_by, recipient_id), greatest(created_by, recipient_id))
  where request_id is null;
create unique index conversations_request_pair_unique on public.conversations
  (request_id, least(created_by, recipient_id), greatest(created_by, recipient_id))
  where request_id is not null;

create or replace function app_private.can_create_conversation(
  sender_id uuid, target_id uuid, contact_context text, target_request_id uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select sender_id = (select auth.uid()) and sender_id <> target_id and exists (
    select 1
    from public.profiles sender
    join public.profiles recipient on recipient.id = target_id
    where sender.id = sender_id and (
      -- A customer may initiate contact with a verified professional.
      (sender.account_type = 'customer' and recipient.account_type = 'professional'
        and exists (select 1 from public.professional_profiles p
          where p.user_id = target_id and p.verification_status = 'verified')
        and (
          (target_request_id is null and contact_context in ('profile', 'post', 'search', 'quote'))
          or (target_request_id is not null and contact_context in ('quote', 'request')
            and exists (select 1 from public.service_requests r
              where r.id = target_request_id and r.customer_id = sender_id))
        ))
      or
      -- A professional may initiate only after a real response to this
      -- customer's published request, or after the customer contacted them.
      (sender.account_type = 'professional' and recipient.account_type = 'customer'
        and exists (select 1 from public.professional_profiles p
          where p.user_id = sender_id and p.verification_status = 'verified')
        and (
          (contact_context = 'request' and target_request_id is not null
            and exists (select 1 from public.service_requests r
              join public.service_request_responses response
                on response.request_id = r.id
              where r.id = target_request_id and r.customer_id = target_id
                and r.status in ('open', 'in_progress', 'closed')
                and response.professional_id = sender_id
                and response.status in ('sent', 'accepted')))
          or (contact_context = 'reply' and target_request_id is null
            and exists (select 1 from public.conversations previous
              where previous.created_by = target_id
                and previous.recipient_id = sender_id))
        ))
    )
  );
$$;
revoke all on function app_private.can_create_conversation(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function app_private.can_create_conversation(uuid, uuid, text, uuid)
  to authenticated;

-- Membership must be attached to the validated pair, including for the first
-- message. The trigger runs as its owner because clients cannot insert members.
drop trigger conversation_creator_is_member on public.conversations;
drop function app_private.add_conversation_creator();
revoke insert, delete on public.conversation_members from authenticated;
drop policy conversation_members_add on public.conversation_members;
drop function app_private.can_add_conversation_member(uuid);

create function app_private.add_conversation_participants()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.conversation_members (conversation_id, user_id)
  values (new.id, new.created_by), (new.id, new.recipient_id);
  return new;
end;
$$;
revoke all on function app_private.add_conversation_participants()
  from public, anon, authenticated;
create trigger conversation_participants after insert on public.conversations
for each row execute function app_private.add_conversation_participants();

drop policy conversations_add on public.conversations;
create policy conversations_add on public.conversations for insert to authenticated
  with check (app_private.can_create_conversation(
    created_by, recipient_id, context, request_id
  ));

create function app_private.can_send_in_conversation(target_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.conversations c
    join public.conversation_members member
      on member.conversation_id = c.id and member.user_id = (select auth.uid())
    join public.profiles starter on starter.id = c.created_by
    join public.profiles recipient on recipient.id = c.recipient_id
    where c.id = target_conversation
      and (
        (starter.account_type = 'customer' and recipient.account_type = 'professional'
          and exists (select 1 from public.professional_profiles p
            where p.user_id = recipient.id and p.verification_status = 'verified'))
        or
        (starter.account_type = 'professional' and recipient.account_type = 'customer'
          and exists (select 1 from public.professional_profiles p
            where p.user_id = starter.id and p.verification_status = 'verified'))
      )
  );
$$;
revoke all on function app_private.can_send_in_conversation(uuid)
  from public, anon, authenticated;
grant execute on function app_private.can_send_in_conversation(uuid)
  to authenticated;

drop policy messages_add on public.messages;
create policy messages_add on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid())
    and app_private.can_send_in_conversation(conversation_id));
