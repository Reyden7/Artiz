-- Keep the professional decision history without retaining the reviewer ID
-- or blocking deletion of the admin's Auth account.
alter table app_private.professional_verification_decisions
  drop constraint professional_verification_decisions_admin_id_fkey;
alter table app_private.professional_verification_decisions
  alter column admin_id drop not null;
alter table app_private.professional_verification_decisions
  add constraint professional_verification_decisions_admin_id_fkey
  foreign key (admin_id) references app_private.admin_members(user_id) on delete set null;
