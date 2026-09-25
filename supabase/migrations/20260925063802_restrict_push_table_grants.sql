-- Supabase's default grants on newly created public tables are broader than needed.
revoke all on public.push_tokens from anon, authenticated;
grant select, delete on public.push_tokens to authenticated;

revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
grant update (new_messages, request_responses, admin_professionals)
  on public.notification_preferences to authenticated;
