-- Deliver a push for every persisted message to the other conversation member.
-- The notification payload contains only a conversation id, never message text.
create or replace function app_private.notify_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind, payload)
  select cm.user_id, new.sender_id, 'new_message',
    jsonb_build_object('conversation_id', new.conversation_id)
  from public.conversation_members cm
  where cm.conversation_id = new.conversation_id and cm.user_id <> new.sender_id;
  return new;
end;
$$;

-- The existing webhook, retry, and receipt jobs are now scoped to support
-- and private-message alerts. Other notification kinds remain internal.
create or replace function app_private.dispatch_new_support_push()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.notifications n
      where n.id = new.notification_id and n.kind in ('support_request', 'new_message')) then
    perform app_private.call_support_push_dispatcher(new.id, false);
  end if;
  return new;
end;
$$;

create or replace function app_private.retry_due_support_push_deliveries()
returns void language plpgsql security definer set search_path = '' as $$
declare delivery record;
begin
  for delivery in
    select d.id from app_private.push_deliveries d
    join public.notifications n on n.id = d.notification_id
    where n.kind in ('support_request', 'new_message')
      and d.status in ('pending', 'processing')
      and d.next_attempt_at <= now() and d.attempt_count < 5
    order by d.next_attempt_at limit 50
  loop
    perform app_private.call_support_push_dispatcher(delivery.id, false);
  end loop;
  update app_private.push_deliveries d set status = 'failed',
    last_error = 'Retry limit reached', updated_at = now()
    from public.notifications n
    where n.id = d.notification_id and n.kind in ('support_request', 'new_message')
      and d.status in ('pending', 'processing') and d.attempt_count >= 5
      and d.next_attempt_at <= now();
end;
$$;

create or replace function app_private.check_due_support_push_receipts()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update app_private.push_deliveries d set status = 'failed',
    last_error = 'Receipt expired', updated_at = now()
    from public.notifications n
    where n.id = d.notification_id and n.kind in ('support_request', 'new_message')
      and d.status = 'ticketed' and d.ticketed_at < now() - interval '24 hours';
  if exists (select 1 from app_private.push_deliveries d
      join public.notifications n on n.id = d.notification_id
      where n.kind in ('support_request', 'new_message') and d.status = 'ticketed'
        and d.ticketed_at < now() - interval '15 minutes') then
    perform app_private.call_support_push_dispatcher(null, true);
  end if;
end;
$$;

create or replace function public.due_push_receipts()
returns table (id uuid, expo_ticket_id text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.expo_ticket_id from app_private.push_deliveries d
  join public.notifications n on n.id = d.notification_id
  where n.kind in ('support_request', 'new_message') and d.status = 'ticketed'
    and d.ticketed_at < now() - interval '15 minutes'
    and d.ticketed_at > now() - interval '24 hours'
  order by d.ticketed_at limit 100;
$$;
