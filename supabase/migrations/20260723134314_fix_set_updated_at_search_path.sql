-- Security linter flagged set_updated_at() for a mutable search_path
-- (function_search_path_mutable). Pin it so the trigger can't be tricked
-- by a search_path swap.
alter function set_updated_at() set search_path = '';
