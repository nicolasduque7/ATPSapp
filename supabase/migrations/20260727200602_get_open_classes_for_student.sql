-- A browsing student needs to see the host student's name/level on an Open
-- Class pill and its "view + request to join" popup, BEFORE any join
-- relationship exists — get_class_partner_students (previous migration)
-- can't help here since it's gated on an already-approved participation.
-- Same narrow-exposure precedent as get_invite_preview/get_class_partner_students:
-- expose only the display fields a browsing student needs, never widen
-- `students` SELECT RLS itself (that table carries email/age/gender/
-- coaching_note peers shouldn't read).
create or replace function get_open_classes_for_student()
returns table (
  class_id uuid,
  coach_id uuid,
  coach_name text,
  location_id uuid,
  start_time timestamp,
  end_time timestamp,
  duration_minutes smallint,
  class_type class_type,
  host_student_id uuid,
  host_student_name text,
  host_student_level student_level,
  max_joiners smallint
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.coach_id,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.email),
    c.location_id,
    c.start_time,
    c.end_time,
    c.duration_minutes,
    c.class_type,
    s.id,
    s.name,
    s.level,
    c.max_joiners
  from classes c
  join students s on s.id = c.student_id
  join auth.users u on u.id = c.coach_id
  where is_student() and c.is_open = true;
$$;
revoke execute on function get_open_classes_for_student() from public, anon;
grant execute on function get_open_classes_for_student() to authenticated;
