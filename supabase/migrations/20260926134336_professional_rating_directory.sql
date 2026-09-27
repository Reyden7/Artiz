-- One aggregate query for the visible directory page, including unrated pros.
create function public.professional_rating_summaries(target_professionals uuid[])
returns table (user_id uuid, average_rating numeric, review_count bigint)
language sql stable security invoker set search_path = '' as $$
  select p.user_id, round(avg(r.rating)::numeric, 1), count(r.id)
  from public.professional_profiles p
  left join public.reviews r on r.professional_id = p.user_id
  where (select auth.uid()) is not null
    and p.user_id = any(target_professionals)
    and p.verification_status = 'verified'
  group by p.user_id;
$$;
revoke all on function public.professional_rating_summaries(uuid[]) from public, anon;
grant execute on function public.professional_rating_summaries(uuid[]) to authenticated;
