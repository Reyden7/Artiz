create or replace function public.search_professionals(
  search_text text default '',
  filter_category uuid default null,
  filter_city text default null,
  page_number integer default 0,
  page_size integer default 20
)
returns table (user_id uuid, business_name text, headline text, city text)
language sql stable security invoker set search_path = '' as $$
  select p.user_id, p.business_name, p.headline, p.city
  from public.professional_profiles p
  join public.profiles a on a.id = p.user_id
  where (select auth.uid()) is not null
    and a.account_type = 'professional'
    and p.verification_status = 'verified'
    and (filter_category is null or exists (
      select 1 from public.professional_category_links l
      where l.professional_id = p.user_id and l.category_id = filter_category
    ))
    and (nullif(btrim(filter_city), '') is null
      or p.city ilike '%' || left(btrim(filter_city), 80) || '%')
    and (nullif(btrim(search_text), '') is null
      or p.business_name ilike '%' || left(btrim(search_text), 100) || '%'
      or p.headline ilike '%' || left(btrim(search_text), 100) || '%'
      or p.city ilike '%' || left(btrim(search_text), 100) || '%'
      or exists (
        select 1 from public.professional_services s
        where s.professional_id = p.user_id and s.is_active
          and s.title ilike '%' || left(btrim(search_text), 100) || '%'
      )
      or exists (
        select 1 from public.professional_category_links l
        join public.professional_categories c on c.id = l.category_id
        where l.professional_id = p.user_id
          and c.name ilike '%' || left(btrim(search_text), 100) || '%'
      ))
  order by p.business_name, p.user_id
  limit least(greatest(coalesce(page_size, 20), 1), 40)
  offset least(greatest(coalesce(page_number, 0), 0), 250) * least(greatest(coalesce(page_size, 20), 1), 40);
$$;
