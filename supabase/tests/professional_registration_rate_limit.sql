-- Five checks per account and hour; clients cannot call the server counter.
begin;
insert into auth.users (id) values ('00000000-0000-4000-8000-000000000801');
do $$ begin
  for attempt in 1..5 loop
    if not public.record_professional_registration_attempt(
      '00000000-0000-4000-8000-000000000801') then
      raise exception 'registration throttled before the fifth request';
    end if;
  end loop;
  if public.record_professional_registration_attempt(
    '00000000-0000-4000-8000-000000000801') then
    raise exception 'sixth registration attempt bypassed rate limit';
  end if;
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
do $$ begin
  begin
    perform public.record_professional_registration_attempt(
      '00000000-0000-4000-8000-000000000801');
    raise exception 'client called the server rate limiter';
  exception when insufficient_privilege then null;
  end;
end; $$;
rollback;
