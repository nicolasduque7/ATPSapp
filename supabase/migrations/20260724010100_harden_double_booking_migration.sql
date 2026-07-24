-- Follow-up hardening for the double-booking migration, per Supabase's
-- security advisor:
-- 1. btree_gist landed in the `public` schema by default; move it to
--    `extensions`, matching where pgcrypto/uuid-ossp/pg_stat_statements
--    already live in this project.
-- 2. Postgres grants EXECUTE on new functions to PUBLIC (including the
--    unauthenticated `anon` role) unless revoked — explicitly restrict
--    check_student_conflict to signed-in coaches only.
alter extension btree_gist set schema extensions;

revoke execute on function check_student_conflict(uuid, timestamp, timestamp, uuid) from public;
revoke execute on function check_student_conflict(uuid, timestamp, timestamp, uuid) from anon;
grant execute on function check_student_conflict(uuid, timestamp, timestamp, uuid) to authenticated;
