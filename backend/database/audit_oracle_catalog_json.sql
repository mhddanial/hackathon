-- One JSON result for CLI/Management API evidence; no user records returned.
BEGIN TRANSACTION READ ONLY;
SELECT jsonb_build_object(
  'tables', (SELECT coalesce(jsonb_agg(x ORDER BY table_name), '[]'::jsonb) FROM (
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  ) x),
  'columns', (SELECT coalesce(jsonb_agg(x ORDER BY table_name, ordinal_position), '[]'::jsonb) FROM (
    SELECT table_name, column_name, data_type, is_nullable, column_default, ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('conversations', 'chat_messages', 'route_query_log')
  ) x),
  'policies', (SELECT coalesce(jsonb_agg(x ORDER BY tablename, policyname), '[]'::jsonb) FROM (
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_catalog.pg_policies WHERE schemaname = 'public'
  ) x),
  'grants', (SELECT coalesce(jsonb_agg(x ORDER BY table_name, grantee, privilege_type), '[]'::jsonb) FROM (
    SELECT table_name, grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('conversations', 'chat_messages', 'route_query_log')
      AND grantee IN ('anon', 'authenticated', 'service_role')
  ) x),
  'constraints', (SELECT coalesce(jsonb_agg(x ORDER BY table_name, constraint_name), '[]'::jsonb) FROM (
    SELECT t.relname AS table_name, c.conname AS constraint_name,
           pg_catalog.pg_get_constraintdef(c.oid) AS definition
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname IN ('conversations', 'chat_messages', 'route_query_log')
  ) x)
) AS audit;
COMMIT;
