-- Students can now self-book: insert/update/delete their OWN classes and
-- recurring series (student_id = their linked row), with any coach. Per
-- product decision, a student may act on ANY class/series where they are the
-- student — including ones a coach booked for them — so there's no
-- "who created it" restriction here, same as the existing student read
-- policy (classes_select_own_as_student) is already keyed purely on
-- student_id, not who inserted the row.

create policy "classes_insert_own_as_student" on classes
  for insert to authenticated with check (
    is_student() and exists (
      select 1 from students s where s.id = classes.student_id and s.auth_user_id = auth.uid()
    )
  );
create policy "classes_update_own_as_student" on classes
  for update to authenticated
  using (
    is_student() and exists (
      select 1 from students s where s.id = classes.student_id and s.auth_user_id = auth.uid()
    )
  )
  with check (
    is_student() and exists (
      select 1 from students s where s.id = classes.student_id and s.auth_user_id = auth.uid()
    )
  );
create policy "classes_delete_own_as_student" on classes
  for delete to authenticated using (
    is_student() and exists (
      select 1 from students s where s.id = classes.student_id and s.auth_user_id = auth.uid()
    )
  );

-- class_series was fully coach-private until now (zero student policies of
-- any kind). Students booking recurring series need the full set, including
-- SELECT — needed so the booking dialog's "whole series" edit scope can
-- lazily hydrate the authoritative recurrence pattern, the student-side
-- equivalent of getClassSeriesMeta.
create policy "class_series_select_own_as_student" on class_series
  for select to authenticated using (
    is_student() and exists (
      select 1 from students s where s.id = class_series.student_id and s.auth_user_id = auth.uid()
    )
  );
create policy "class_series_insert_own_as_student" on class_series
  for insert to authenticated with check (
    is_student() and exists (
      select 1 from students s where s.id = class_series.student_id and s.auth_user_id = auth.uid()
    )
  );
create policy "class_series_update_own_as_student" on class_series
  for update to authenticated
  using (
    is_student() and exists (
      select 1 from students s where s.id = class_series.student_id and s.auth_user_id = auth.uid()
    )
  )
  with check (
    is_student() and exists (
      select 1 from students s where s.id = class_series.student_id and s.auth_user_id = auth.uid()
    )
  );
create policy "class_series_delete_own_as_student" on class_series
  for delete to authenticated using (
    is_student() and exists (
      select 1 from students s where s.id = class_series.student_id and s.auth_user_id = auth.uid()
    )
  );

-- Relax check_student_conflict's is_coach()-only guard: a student may now
-- get a real answer, but ONLY when checking their own student_id — this
-- preserves the original intent (no probing an unrelated student's
-- schedule/coach) while unblocking self-booking's pre-check.
create or replace function check_student_conflict(
  p_student_id uuid,
  p_start_time timestamp,
  p_end_time timestamp,
  p_exclude_class_id uuid default null
)
returns table (coach_name text, start_time timestamp, end_time timestamp)
language sql security definer set search_path = public as $$
  select
    coalesce(u.raw_user_meta_data ->> 'full_name', u.email) as coach_name,
    c.start_time,
    c.end_time
  from classes c
  join auth.users u on u.id = c.coach_id
  where (
      is_coach()
      or (is_student() and p_student_id = (select id from students where auth_user_id = auth.uid()))
    )
    and c.student_id = p_student_id
    and tsrange(c.start_time, c.end_time) && tsrange(p_start_time, p_end_time)
    and (p_exclude_class_id is null or c.id != p_exclude_class_id)
  limit 1;
$$;

-- classes_no_student_overlap (the GiST exclusion constraint) needs no
-- changes — already keyed on student_id, protects regardless of caller.
