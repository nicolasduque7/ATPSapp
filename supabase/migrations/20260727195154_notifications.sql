-- Generic in-app notifications. Deliberately NOT a normalized/typed-column
-- design: a future notification (e.g. "this class was edited/deleted") must
-- be able to describe a row that may no longer exist by the time it's
-- rendered — a self-contained jsonb payload survives that; foreign keys to
-- the source row would not. `type` is plain text (not an enum) so adding a
-- new notification type later needs no migration, only a new string, a
-- payload shape, and a UI branch.
--
-- Same "write-only-via-function" shape as `profiles`: no insert/delete
-- policy for `authenticated` at all, so a client can never forge a
-- notification "from" someone else or write into someone else's inbox.
-- `read_at` gets a plain client UPDATE policy (self-only, low-risk) since
-- there's no reason to route "mark as read" through an RPC.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on notifications (recipient_id, created_at desc);

alter table notifications enable row level security;

create policy "notifications_select_own" on notifications
  for select to authenticated using (recipient_id = auth.uid());
create policy "notifications_update_own_read_at" on notifications
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- The coach's decision on a join request. Locks both rows (for update) to
-- avoid a race between two concurrent decisions or a decision racing a
-- capacity check. Re-validates everything at decision time rather than
-- trusting request_to_join_class's earlier soft check, since time may have
-- passed and capacity/conflicts can have changed.
create or replace function decide_join_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_request class_join_requests%rowtype;
  v_class classes%rowtype;
  v_joiner_count int;
  v_conflict record;
  v_host_auth_user_id uuid;
begin
  if not is_coach() then
    raise exception 'Only a coach can decide a join request.';
  end if;

  select * into v_request from class_join_requests where id = p_request_id for update;
  if not found then
    raise exception 'Join request not found.';
  end if;
  if v_request.status != 'pending' then
    raise exception 'This request has already been decided.';
  end if;

  select * into v_class from classes where id = v_request.class_id for update;
  if not found or v_class.coach_id != auth.uid() then
    raise exception 'You do not coach this class.';
  end if;

  if not p_approve then
    update class_join_requests
       set status = 'rejected', decided_at = now(), decided_by = auth.uid()
     where id = p_request_id;

    insert into notifications (recipient_id, type, payload)
      values (
        (select auth_user_id from students where id = v_request.requesting_student_id),
        'join_request_rejected',
        jsonb_build_object(
          'request_id', p_request_id, 'class_id', v_class.id,
          'start_time', v_class.start_time, 'end_time', v_class.end_time
        )
      );
    return;
  end if;

  if not v_class.is_open then
    raise exception 'This class is no longer open.';
  end if;

  select count(*) into v_joiner_count from class_participants where class_id = v_class.id;
  if v_joiner_count >= v_class.max_joiners then
    raise exception 'This class is already full.';
  end if;

  select coach_name, start_time, end_time into v_conflict
    from check_student_conflict(v_request.requesting_student_id, v_class.start_time, v_class.end_time);
  if v_conflict.start_time is not null then
    raise exception 'This student has a scheduling conflict at that time.';
  end if;

  insert into class_participants (class_id, student_id, start_time, end_time)
    values (v_class.id, v_request.requesting_student_id, v_class.start_time, v_class.end_time);

  update classes set class_type = 'Group' where id = v_class.id;

  update class_join_requests
     set status = 'approved', decided_at = now(), decided_by = auth.uid()
   where id = p_request_id;

  insert into notifications (recipient_id, type, payload)
    values (
      (select auth_user_id from students where id = v_request.requesting_student_id),
      'join_request_approved',
      jsonb_build_object(
        'request_id', p_request_id, 'class_id', v_class.id,
        'start_time', v_class.start_time, 'end_time', v_class.end_time
      )
    );
  -- The host may not have a linked login yet (added by a coach but never
  -- invited) — skip their notification rather than failing the whole
  -- approval, since notifications.recipient_id is NOT NULL.
  select auth_user_id into v_host_auth_user_id from students where id = v_class.student_id;
  if v_host_auth_user_id is not null then
    insert into notifications (recipient_id, type, payload)
      values (
        v_host_auth_user_id,
        'class_joined',
        jsonb_build_object(
          'request_id', p_request_id, 'class_id', v_class.id,
          'joining_student_id', v_request.requesting_student_id,
          'joining_student_name', (select name from students where id = v_request.requesting_student_id),
          'start_time', v_class.start_time, 'end_time', v_class.end_time
        )
      );
  end if;
end;
$$;
revoke execute on function decide_join_request(uuid, boolean) from public, anon;
grant execute on function decide_join_request(uuid, boolean) to authenticated;

-- Exposes only the specific display fields a "partner student" card needs
-- (Name, Nickname, level, racket, the 6 stroke ratings) — deliberately NOT a
-- broadened `students` SELECT policy between students, since that table also
-- carries real PII (email, age, gender, coaching_note) peers shouldn't read.
-- Gated on an actual relationship: caller hosts this class (-> see every
-- approved joiner), or caller is an approved joiner of it (-> see the host).
create or replace function get_class_partner_students(p_class_id uuid)
returns table (
  student_id uuid, name text, nickname text, level student_level, racket_type text,
  forehand_rating smallint, backhand_rating smallint, backhand_slice_rating smallint,
  volley_rating smallint, serve_rating smallint, drop_shot_rating smallint
)
language sql stable security definer set search_path = public as $$
  with me as (select id from students where auth_user_id = auth.uid())
  select s.id, s.name, s.nickname, s.level, s.racket_type,
         s.forehand_rating, s.backhand_rating, s.backhand_slice_rating,
         s.volley_rating, s.serve_rating, s.drop_shot_rating
  from class_participants cp
  join students s on s.id = cp.student_id
  where cp.class_id = p_class_id
    and exists (select 1 from classes c join me on c.student_id = me.id where c.id = p_class_id)
  union all
  select s.id, s.name, s.nickname, s.level, s.racket_type,
         s.forehand_rating, s.backhand_rating, s.backhand_slice_rating,
         s.volley_rating, s.serve_rating, s.drop_shot_rating
  from classes c
  join students s on s.id = c.student_id
  where c.id = p_class_id
    and exists (select 1 from class_participants cp join me on cp.student_id = me.id where cp.class_id = p_class_id);
$$;
revoke execute on function get_class_partner_students(uuid) from public, anon;
grant execute on function get_class_partner_students(uuid) to authenticated;
