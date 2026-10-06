-- Metadata and aggregate counts only. No user records or keys.
BEGIN TRANSACTION READ ONLY;
SELECT jsonb_build_object(
  'tables', (SELECT jsonb_agg(x ORDER BY table_name) FROM (
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'
  ) x),
  'columns', (SELECT jsonb_agg(x ORDER BY table_name,ordinal_position) FROM (
    SELECT table_name,column_name,data_type,is_nullable,column_default,ordinal_position
    FROM information_schema.columns WHERE table_schema='public'
      AND table_name IN ('road_segments','congestion_multipliers','ferry_schedules','route_query_log')
  ) x),
  'grants', (SELECT coalesce(jsonb_agg(x ORDER BY table_name,grantee,privilege_type),'[]'::jsonb) FROM (
    SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants
    WHERE table_schema='public'
      AND table_name IN ('road_segments','congestion_multipliers','ferry_schedules','route_query_log')
  ) x),
  'policies', (SELECT coalesce(jsonb_agg(x ORDER BY tablename,policyname),'[]'::jsonb) FROM (
    SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_catalog.pg_policies
    WHERE schemaname='public'
  ) x),
  'counts', jsonb_build_object(
    'road_segments',(SELECT count(*) FROM public.road_segments),
    'congestion_multipliers',(SELECT count(*) FROM public.congestion_multipliers),
    'ferry_schedules',(SELECT count(*) FROM public.ferry_schedules),
    'route_query_log',(SELECT count(*) FROM public.route_query_log))
) AS audit;
COMMIT;
