-- Accounts that existed before the app's schema get a profile too.
-- When nobody has a profile yet, the oldest account becomes an approved admin,
-- the same rule handle_new_user() applies to new sign-ups.

insert into public.profiles (id, full_name, email, role, status)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), u.email, ''),
  coalesce(u.email, ''),
  case when u.is_first then 'admin' else 'member' end::public.user_role,
  case when u.is_first then 'approved' else 'pending' end::public.account_status
from (
  select
    users.*,
    row_number() over (order by users.created_at) = 1
      and not exists (select 1 from public.profiles) as is_first
  from auth.users users
) u
where not exists (select 1 from public.profiles p where p.id = u.id);
