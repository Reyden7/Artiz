-- Hiding a direct thread is a member's private inbox state, never a deletion.
alter table public.conversation_members add column hidden_at timestamptz;

-- The existing UPDATE policy restricts each member to their own row.
grant update (hidden_at) on public.conversation_members to authenticated;
revoke delete on public.messages from authenticated;

create or replace function public.list_my_direct_conversations()
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
      and member.hidden_at is null
  join public.profiles p on p.id =
    case when c.created_by = (select auth.uid()) then c.recipient_id else c.created_by end
  left join lateral (
    select m.body, m.created_at from public.messages m
    where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1
  ) latest on true
  order by coalesce(latest.created_at, c.created_at) desc, c.id;
$$;

create or replace function public.unread_message_counts()
returns table (conversation_id uuid, unread_count bigint)
language sql stable security invoker set search_path = '' as $$
  select cm.conversation_id, count(m.id)::bigint
  from public.conversation_members cm
  left join public.messages m
    on m.conversation_id = cm.conversation_id
    and m.sender_id <> cm.user_id
    and m.created_at > coalesce(cm.last_read_at, cm.joined_at)
  where cm.user_id = (select auth.uid()) and cm.hidden_at is null
  group by cm.conversation_id;
$$;

-- Every new message makes the existing thread visible again to its members.
-- Running as the trigger owner is necessary to restore the other member's row.
create function app_private.unhide_direct_conversation_on_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversation_members cm set hidden_at = null
  where cm.conversation_id = new.conversation_id and cm.hidden_at is not null;
  return new;
end;
$$;
revoke all on function app_private.unhide_direct_conversation_on_message()
  from public, anon, authenticated;
create trigger messages_unhide_direct_conversation after insert on public.messages
for each row execute function app_private.unhide_direct_conversation_on_message();
