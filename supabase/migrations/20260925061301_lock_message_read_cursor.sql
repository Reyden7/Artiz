-- Clients may only advance their own read cursor through the checked RPC.
revoke update (last_read_at) on public.conversation_members from authenticated;

create or replace function public.mark_conversation_read(target_conversation uuid, through_message uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  reader_id uuid := (select auth.uid());
  message_time timestamptz;
begin
  if reader_id is null or not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation and cm.user_id = reader_id
  ) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;

  select m.created_at into message_time
  from public.messages m
  where m.id = through_message and m.conversation_id = target_conversation;

  if message_time is null then
    raise exception 'Message unavailable' using errcode = '22023';
  end if;

  update public.conversation_members cm
  set last_read_at = greatest(coalesce(cm.last_read_at, cm.joined_at), message_time)
  where cm.conversation_id = target_conversation and cm.user_id = reader_id;
end;
$$;
revoke all on function public.mark_conversation_read(uuid, uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid, uuid) to authenticated;
