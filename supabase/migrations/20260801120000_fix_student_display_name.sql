-- The student branch of handle_new_user() inserted profiles.display_name
-- from raw_user_meta_data->>'full_name', but the invite-redemption flow
-- never sends a name in that metadata (the invite form is password-only,
-- name already lives on the students row) — so it was always inserted as
-- NULL, with no fallback like the coach branch has. Read it straight off
-- the students row this trigger just linked instead.

create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_invite student_invites%rowtype;
  v_student_name text;
begin
  v_token := new.raw_user_meta_data ->> 'invite_token';

  if v_token is null then
    insert into profiles (id, role, display_name)
    values (new.id, 'coach', coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
    return new;
  end if;

  select * into v_invite from student_invites where token = v_token for update;
  if not found then
    raise exception 'This invite link is invalid.';
  end if;
  if v_invite.redeemed_at is not null then
    raise exception 'This invite has already been used.';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite has expired. Ask your coach to resend it.';
  end if;
  if lower(v_invite.email) is distinct from lower(new.email) then
    raise exception 'This invite was issued to a different email address.';
  end if;

  update students
     set auth_user_id = new.id, email = coalesce(email, new.email)
   where id = v_invite.student_id and auth_user_id is null
  returning name into v_student_name;
  if not found then
    raise exception 'This student is already linked to another account.';
  end if;

  update student_invites set redeemed_at = now(), redeemed_by = new.id where id = v_invite.id;
  insert into profiles (id, role, display_name)
    values (new.id, 'student', coalesce(v_student_name, new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

-- Backfill any student profiles already created with a null display_name.
update profiles p
set display_name = s.name
from students s
where s.auth_user_id = p.id
  and p.role = 'student'
  and p.display_name is null
  and s.name is not null;
