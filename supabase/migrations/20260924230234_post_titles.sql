-- A realization has a separate title while retaining the existing body text.
alter table public.posts add column title text;
update public.posts
  set title = case when char_length(btrim(body)) < 2 then 'Réalisation'
    else left(btrim(body), 120) end;
alter table public.posts alter column title set not null;
alter table public.posts add constraint posts_title_length
  check (char_length(btrim(title)) between 2 and 120);
