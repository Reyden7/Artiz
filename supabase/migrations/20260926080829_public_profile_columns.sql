-- Coordinates are never public profile fields. Expose only the fields used by
-- profile cards, search, and the owner's own edit form through the Data API.
revoke select on public.profiles from authenticated;
grant select (id, display_name, account_type, avatar_path, city, postal_code,
  bio, created_at, updated_at) on public.profiles to authenticated;

revoke select on public.professional_profiles from authenticated;
grant select (user_id, business_name, headline, description, cover_path,
  website_url, city, postal_code, service_radius_km, verification_status,
  created_at, updated_at) on public.professional_profiles to authenticated;
