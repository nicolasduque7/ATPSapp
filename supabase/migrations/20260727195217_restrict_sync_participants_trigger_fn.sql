-- sync_class_participants_time is a trigger-only function (see
-- class_participants migration) -- it should never be callable directly via
-- PostgREST's auto-exposed RPC, same as handle_new_user() is locked down.
revoke execute on function sync_class_participants_time() from public, anon, authenticated;
