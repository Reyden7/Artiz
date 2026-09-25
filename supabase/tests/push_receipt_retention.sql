-- Token revocation must not erase Expo tickets awaiting a delivery receipt.
begin;
insert into auth.users (id, email_confirmed_at)
values ('00000000-0000-4000-8000-000000000971', now());

insert into public.notifications (id, recipient_id, kind)
values ('00000000-0000-4000-8000-000000000973',
        '00000000-0000-4000-8000-000000000971', 'support_request'),
       ('00000000-0000-4000-8000-000000000974',
        '00000000-0000-4000-8000-000000000971', 'support_request');

insert into public.push_tokens (id, user_id, expo_push_token, platform)
values ('00000000-0000-4000-8000-000000000972',
        '00000000-0000-4000-8000-000000000971',
        'ExpoPushToken[receipt-retention-fixture]', 'android');

insert into app_private.push_deliveries
  (id, notification_id, token_id, status, expo_ticket_id, ticketed_at)
values ('00000000-0000-4000-8000-000000000975',
        '00000000-0000-4000-8000-000000000973',
        '00000000-0000-4000-8000-000000000972',
        'ticketed', 'receipt-retention-fixture', now()),
       ('00000000-0000-4000-8000-000000000976',
        '00000000-0000-4000-8000-000000000974',
        '00000000-0000-4000-8000-000000000972',
        'pending', null, null);

delete from public.push_tokens
where id = '00000000-0000-4000-8000-000000000972';

do $$ begin
  if not exists (
    select 1 from app_private.push_deliveries
    where id = '00000000-0000-4000-8000-000000000975'
      and token_id is null and status = 'ticketed'
      and expo_ticket_id = 'receipt-retention-fixture'
  ) then raise exception 'Ticket was lost during token revocation'; end if;
  if not exists (
    select 1 from app_private.push_deliveries
    where id = '00000000-0000-4000-8000-000000000976'
      and token_id is null and status = 'disabled'
  ) then raise exception 'Pending delivery remained active after token revocation'; end if;
end $$;

select public.finish_push_receipt('00000000-0000-4000-8000-000000000975',
                                  'delivered', null);
do $$ begin
  if not exists (
    select 1 from app_private.push_deliveries
    where id = '00000000-0000-4000-8000-000000000975'
      and token_id is null and status = 'delivered'
  ) then raise exception 'Detached ticket could not receive its Expo receipt'; end if;
end $$;
rollback;
