-- Independent digital trades are part of the Artiz professional directory.
insert into public.professional_categories (slug, name)
values ('services-numeriques', 'Services numériques')
on conflict (slug) do nothing;
