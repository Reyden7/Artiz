-- Apply only after the dispatch-push Edge Function is approved and deployed.
-- This is the sole migration that sends device tokens and notification text to Expo.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create function app_private.call_push_dispatcher(delivery_id uuid default null, receipt_check boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare webhook_secret text;
begin
  select s.decrypted_secret into webhook_secret from vault.decrypted_secrets s
    where s.name = 'artiz_push_webhook_secret';
  if webhook_secret is null then raise exception 'Push webhook secret missing'; end if;
  perform net.http_post(
    url := 'https://iytqumospebawpavlauj.supabase.co/functions/v1/dispatch-push',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || webhook_secret),
    body := case when receipt_check then jsonb_build_object('mode', 'receipts')
      else jsonb_build_object('delivery_id', delivery_id) end,
    timeout_milliseconds := 10000
  );
end;
$$;
revoke all on function app_private.call_push_dispatcher(uuid, boolean) from public, anon, authenticated;

create function app_private.dispatch_new_push_delivery()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.call_push_dispatcher(new.id, false);
  return new;
end;
$$;
create trigger push_delivery_webhook after insert on app_private.push_deliveries
  for each row execute function app_private.dispatch_new_push_delivery();

create function app_private.retry_due_push_deliveries()
returns void language plpgsql security definer set search_path = '' as $$
declare delivery record;
begin
  for delivery in
    select d.id from app_private.push_deliveries d
    where d.status in ('pending', 'processing') and d.next_attempt_at <= now()
      and d.attempt_count < 5
    order by d.next_attempt_at limit 50
  loop
    perform app_private.call_push_dispatcher(delivery.id, false);
  end loop;
  update app_private.push_deliveries d set status = 'failed',
    last_error = 'Retry limit reached', updated_at = now()
    where d.status in ('pending', 'processing') and d.attempt_count >= 5
      and d.next_attempt_at <= now();
end;
$$;
revoke all on function app_private.retry_due_push_deliveries() from public, anon, authenticated;

create function app_private.check_due_push_receipts()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update app_private.push_deliveries d set status = 'failed',
    last_error = 'Receipt expired', updated_at = now()
    where d.status = 'ticketed' and d.ticketed_at < now() - interval '24 hours';
  if exists (select 1 from app_private.push_deliveries d
      where d.status = 'ticketed' and d.ticketed_at < now() - interval '15 minutes') then
    perform app_private.call_push_dispatcher(null, true);
  end if;
end;
$$;
revoke all on function app_private.check_due_push_receipts() from public, anon, authenticated;

select cron.schedule('artiz-push-retry', '* * * * *',
  $$select app_private.retry_due_push_deliveries();$$);
select cron.schedule('artiz-push-receipts', '*/15 * * * *',
  $$select app_private.check_due_push_receipts();$$);
