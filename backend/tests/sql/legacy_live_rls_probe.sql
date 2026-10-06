-- Installed-policy checks. All synthetic rows and temporary state are rolled back.
-- Existing Auth IDs are used internally; only check counts leave the database.
BEGIN;
SET LOCAL statement_timeout = '30s';
CREATE TEMP TABLE legacy_probe_state AS
SELECT (array_agg(id ORDER BY id))[1] AS user_a,
       (array_agg(id ORDER BY id))[2] AS user_b,
       gen_random_uuid() AS id_a, gen_random_uuid() AS id_b,
       gen_random_uuid() AS id_ownerless
FROM (SELECT id FROM auth.users ORDER BY id LIMIT 2) u;
GRANT SELECT ON legacy_probe_state TO anon, authenticated;
DO $$
BEGIN
  IF (SELECT user_b IS NULL FROM legacy_probe_state) THEN
    RAISE EXCEPTION 'Two existing identities required for isolation probe';
  END IF;
END;
$$;
INSERT INTO public.route_query_log (id,user_id,origin,destination,result_json)
SELECT id_a,user_a,'RLS probe','Synthetic destination','{}'::jsonb FROM legacy_probe_state
UNION ALL SELECT id_b,user_b,'RLS probe','Synthetic destination','{}'::jsonb FROM legacy_probe_state
UNION ALL SELECT id_ownerless,NULL,'RLS probe','Synthetic destination','{}'::jsonb FROM legacy_probe_state;

DO $$
DECLARE
  table_name text;
  role_name text;
  operation text;
  owner_id uuid;
  owned_id uuid;
  foreign_id uuid;
  ownerless_id uuid;
  seen bigint;
  checks integer := 0;
  denied boolean;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I',role_name);
    PERFORM set_config('request.jwt.claim.sub','',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('role',role_name)::text,true);
    FOREACH table_name IN ARRAY ARRAY['road_segments','congestion_multipliers','ferry_schedules'] LOOP
      EXECUTE format('SELECT count(*) FROM public.%I',table_name) INTO seen;
      IF seen=0 THEN RAISE EXCEPTION 'Reference reads unexpectedly empty'; END IF;
      checks := checks+1;
    END LOOP;
    FOREACH table_name IN ARRAY ARRAY['road_segments','congestion_multipliers','ferry_schedules','route_query_log'] LOOP
      FOREACH operation IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE'] LOOP
        denied := false;
        BEGIN
          CASE operation
            WHEN 'INSERT' THEN EXECUTE format('INSERT INTO public.%I DEFAULT VALUES',table_name);
            WHEN 'UPDATE' THEN EXECUTE format('UPDATE public.%I SET id=id WHERE false',table_name);
            WHEN 'DELETE' THEN EXECUTE format('DELETE FROM public.%I WHERE false',table_name);
            WHEN 'TRUNCATE' THEN EXECUTE format('TRUNCATE public.%I CASCADE',table_name);
          END CASE;
        EXCEPTION WHEN insufficient_privilege THEN denied := true;
        END;
        IF NOT denied THEN RAISE EXCEPTION 'Unexpected % permission for % on %',operation,role_name,table_name; END IF;
        checks := checks+1;
      END LOOP;
    END LOOP;
    IF role_name='anon' THEN
      denied := false;
      BEGIN PERFORM id FROM public.route_query_log;
      EXCEPTION WHEN insufficient_privilege THEN denied := true;
      END;
      IF NOT denied THEN RAISE EXCEPTION 'Anonymous route history was readable'; END IF;
      checks := checks+1;
    ELSE
      SELECT count(*) INTO seen FROM public.route_query_log;
      IF seen<>0 THEN RAISE EXCEPTION 'No-claim history leaked rows'; END IF;
      checks := checks+1;
    END IF;
    EXECUTE 'RESET ROLE';
  END LOOP;

  FOR owner_id,owned_id,foreign_id,ownerless_id IN
    SELECT user_a,id_a,id_b,id_ownerless FROM legacy_probe_state
    UNION ALL SELECT user_b,id_b,id_a,id_ownerless FROM legacy_probe_state
  LOOP
    PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO seen FROM public.route_query_log WHERE id=owned_id;
    IF seen<>1 THEN RAISE EXCEPTION 'Own route history unavailable'; END IF;
    checks := checks+1;
    SELECT count(*) INTO seen FROM public.route_query_log WHERE id=foreign_id;
    IF seen<>0 THEN RAISE EXCEPTION 'Foreign route history visible'; END IF;
    checks := checks+1;
    SELECT count(*) INTO seen FROM public.route_query_log WHERE id=ownerless_id;
    IF seen<>0 THEN RAISE EXCEPTION 'Ownerless route history visible'; END IF;
    checks := checks+1;
    EXECUTE 'RESET ROLE';
  END LOOP;
  PERFORM set_config('legacy_probe.checks',checks::text,true);
END;
$$;
SELECT jsonb_build_object('checks_passed',current_setting('legacy_probe.checks')::integer,
  'scope','Installed policies with simulated database claims',
  'persistent_test_data','none; transaction rolled back') AS probe;
ROLLBACK;
