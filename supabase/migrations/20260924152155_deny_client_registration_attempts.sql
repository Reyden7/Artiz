create policy no_client_registration_attempts
on app_private.professional_registration_attempts for all to anon, authenticated
using (false) with check (false);
