-- Sprint 0 catalog audit: run using authorized SQL-editor/database access.
-- Read-only; returns schema and policy metadata, never user rows.
BEGIN TRANSACTION READ ONLY;

SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  AND c.relname IN ('conversations', 'chat_messages', 'route_query_log',
                   'road_segments', 'congestion_multipliers', 'ferry_schedules')
ORDER BY c.relname;

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('conversations', 'chat_messages', 'route_query_log')
ORDER BY table_name, ordinal_position;

SELECT n.nspname AS schema_name, t.relname AS table_name,
       c.conname AS constraint_name, pg_catalog.pg_get_constraintdef(c.oid) AS definition
FROM pg_catalog.pg_constraint c
JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname IN ('conversations', 'chat_messages', 'route_query_log')
ORDER BY t.relname, c.conname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('conversations', 'chat_messages', 'route_query_log',
                   'road_segments', 'congestion_multipliers', 'ferry_schedules')
ORDER BY tablename, policyname;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('conversations', 'chat_messages', 'route_query_log')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

SELECT tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('conversations', 'chat_messages', 'route_query_log')
ORDER BY tablename, indexname;

COMMIT;
