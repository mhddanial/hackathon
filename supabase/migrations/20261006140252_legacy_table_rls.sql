-- Public reference data stays readable; route history is private and read-only.
-- Apply only after confirmation. No rows are removed or assigned guessed owners.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Unexpected policies could combine permissively and leak private rows.
-- Stop for review rather than replacing unknown policies.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public'
      AND tablename IN ('road_segments','congestion_multipliers','ferry_schedules','route_query_log')
  ) THEN
    RAISE EXCEPTION 'Legacy policies changed: review them before applying this migration';
  END IF;
END;
$$;

-- Old ownerless analytics are retained but remain invisible to API clients.
-- Privileged writers must supply the verified user_id when recording history.
ALTER TABLE public.route_query_log
  ADD COLUMN user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;
-- Set the default separately so existing rows never inherit the migration actor.
ALTER TABLE public.route_query_log ALTER COLUMN user_id SET DEFAULT auth.uid();
CREATE INDEX route_query_log_user_requested_idx
  ON public.route_query_log (user_id, requested_at DESC, id DESC);

ALTER TABLE public.road_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.road_segments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.congestion_multipliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.congestion_multipliers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ferry_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferry_schedules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.route_query_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_query_log FORCE ROW LEVEL SECURITY;

-- Revoke TRUNCATE and other non-row privileges as well as write grants.
REVOKE ALL ON TABLE public.road_segments, public.congestion_multipliers,
  public.ferry_schedules, public.route_query_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.road_segments, public.congestion_multipliers,
  public.ferry_schedules TO anon, authenticated;
GRANT SELECT ON TABLE public.route_query_log TO authenticated;

CREATE POLICY road_segments_public_read ON public.road_segments
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY congestion_multipliers_public_read ON public.congestion_multipliers
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY ferry_schedules_public_read ON public.ferry_schedules
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY route_query_log_owner_read ON public.route_query_log
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- Existing privileged service_role grants are preserved. No browser write path.
NOTIFY pgrst, 'reload schema';
COMMIT;
