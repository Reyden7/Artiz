-- PostgreSQL treats NULL as distinct in the existing three-column unique
-- constraint. Without this index one customer can repeat a request-free review
-- indefinitely and distort the public average.
create unique index reviews_one_without_request_per_customer
  on public.reviews (customer_id, professional_id)
  where request_id is null;
