-- Postgres Changes is delivered only to members allowed by the existing SELECT policies.
alter publication supabase_realtime add table public.messages, public.conversation_members;

create function public.unread_message_counts()
returns table (conversation_id uuid, unread_count bigint)
language sql stable security invoker set search_path = '' as $$
  select cm.conversation_id, count(m.id)::bigint
  from public.conversation_members cm
  left join public.messages m
    on m.conversation_id = cm.conversation_id
    and m.sender_id <> cm.user_id
    and m.created_at > coalesce(cm.last_read_at, cm.joined_at)
  where cm.user_id = (select auth.uid())
  group by cm.conversation_id;
$$;
revoke all on function public.unread_message_counts() from public, anon;
grant execute on function public.unread_message_counts() to authenticated;

-- Use a real stored message as the read cursor; a client cannot submit a future time.
create function public.mark_conversation_read(target_conversation uuid, through_message uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare message_time timestamptz;
begin
  select m.created_at into message_time from public.messages m
    where m.id = through_message and m.conversation_id = target_conversation;
  if message_time is null then
    raise exception 'Message unavailable' using errcode = '22023';
  end if;
  update public.conversation_members cm
    set last_read_at = greatest(coalesce(cm.last_read_at, cm.joined_at), message_time)
    where cm.conversation_id = target_conversation and cm.user_id = (select auth.uid());
  if not found then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.mark_conversation_read(uuid, uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid, uuid) to authenticated;
