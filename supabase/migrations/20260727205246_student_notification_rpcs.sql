-- Student Notifications page needs two directions of data that existing RLS
-- can't serve directly, since `students` SELECT is locked to "your own row"
-- (or a coach's). Same narrow-exposure `security definer` pattern as
-- get_class_partner_students/get_open_classes_for_student.
--
-- 1. "Sent" direction (a student's own class_join_requests, ANY status —
--    pending/approved/rejected all show the host's info, unlike the
--    approval-gated get_class_partner_students which only works once a
--    class_participants row exists).
-- 2. "Received" direction (classes the caller HOSTS that now have
--    participants) — the host only ever learns about DECIDED requests
--    (never raw pending ones, per product decision), so this is naturally
--    just "my classes with approved joiners," not a class_join_requests read.

create or replace function get_sent_join_requests_for_student()
returns table (
  request_id uuid,
  status text,
  created_at timestamptz,
  class_id uuid,
  start_time timestamp,
  end_time timestamp,
  host_student_name text
)
language sql stable security definer set search_path = public as $$
  select r.id, r.status, r.created_at, c.id, c.start_time, c.end_time, s.name
  from class_join_requests r
  join classes c on c.id = r.class_id
  join students s on s.id = c.student_id
  join students me on me.auth_user_id = auth.uid()
  where r.requesting_student_id = me.id
  order by r.created_at desc;
$$;
revoke execute on function get_sent_join_requests_for_student() from public, anon;
grant execute on function get_sent_join_requests_for_student() to authenticated;

-- One-call detail for the "sent" direction's dialog: class details (start/
-- end/location/type) plus the host's full card fields, gated on the caller
-- actually being the requester of this exact request (any status).
create or replace function get_sent_join_request_detail(p_request_id uuid)
returns table (
  status text,
  start_time timestamp,
  end_time timestamp,
  class_type class_type,
  location_name text,
  host_student_id uuid,
  host_name text,
  host_nickname text,
  host_level student_level,
  host_racket_type text,
  host_forehand_rating smallint,
  host_backhand_rating smallint,
  host_backhand_slice_rating smallint,
  host_volley_rating smallint,
  host_serve_rating smallint,
  host_drop_shot_rating smallint
)
language sql stable security definer set search_path = public as $$
  select
    r.status, c.start_time, c.end_time, c.class_type, l.name,
    s.id, s.name, s.nickname, s.level, s.racket_type,
    s.forehand_rating, s.backhand_rating, s.backhand_slice_rating,
    s.volley_rating, s.serve_rating, s.drop_shot_rating
  from class_join_requests r
  join classes c on c.id = r.class_id
  join locations l on l.id = c.location_id
  join students s on s.id = c.student_id
  join students me on me.auth_user_id = auth.uid()
  where r.id = p_request_id and r.requesting_student_id = me.id;
$$;
revoke execute on function get_sent_join_request_detail(uuid) from public, anon;
grant execute on function get_sent_join_request_detail(uuid) to authenticated;

create or replace function get_received_joins_for_student()
returns table (
  class_id uuid,
  start_time timestamp,
  end_time timestamp,
  joining_student_name text,
  joined_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select c.id, c.start_time, c.end_time, s.name, cp.joined_at
  from classes c
  join students me on me.auth_user_id = auth.uid() and c.student_id = me.id
  join class_participants cp on cp.class_id = c.id
  join students s on s.id = cp.student_id
  order by cp.joined_at desc;
$$;
revoke execute on function get_received_joins_for_student() from public, anon;
grant execute on function get_received_joins_for_student() to authenticated;
