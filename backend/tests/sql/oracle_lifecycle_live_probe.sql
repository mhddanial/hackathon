-- Existing Auth IDs stay internal. All synthetic turns are rolled back.
BEGIN;
SET LOCAL statement_timeout='30s';
DO $$
DECLARE
  user_a uuid; user_b uuid; request_id uuid := gen_random_uuid();
  turn jsonb; replay jsonb; stale jsonb; denied boolean; checks integer:=0;
BEGIN
  SELECT (array_agg(id ORDER BY id))[1],(array_agg(id ORDER BY id))[2] INTO user_a,user_b
    FROM (SELECT id FROM auth.users ORDER BY id LIMIT 2) u;
  IF user_b IS NULL THEN RAISE EXCEPTION 'Two existing identities required'; END IF;
  PERFORM set_config('request.jwt.claim.sub',user_a::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',user_a,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  turn:=public.oracle_reserve_turn(request_id,'Synthetic lifecycle probe',NULL);
  IF turn->>'outcome'<>'in_progress' OR (turn->>'replay')::boolean THEN RAISE EXCEPTION 'Reservation failed'; END IF;
  checks:=checks+1;
  denied:=false;
  BEGIN PERFORM public.oracle_reserve_turn(request_id,'Synthetic lifecycle probe',NULL);
  EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Active retry did not conflict'; END IF; checks:=checks+1;
  denied:=false;
  BEGIN UPDATE public.conversations SET archived_at=now() WHERE id=(turn->>'conversation_id')::uuid;
  EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Active archive allowed'; END IF; checks:=checks+1;
  PERFORM public.oracle_record_tool((turn->>'turn_id')::uuid,'probe-call','get_ferry_schedule','{"terminal":"sekupang"}','{"schedules":[]}');
  checks:=checks+1;
  denied:=false;
  BEGIN PERFORM public.oracle_record_tool((turn->>'turn_id')::uuid,'probe-call','get_ferry_schedule','{"terminal":"sekupang"}','{"schedules":[]}');
  EXCEPTION WHEN unique_violation THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Duplicate tool record allowed'; END IF; checks:=checks+1;
  PERFORM public.oracle_finish_turn((turn->>'turn_id')::uuid,'Synthetic saved answer','completed',
    '[{"id":"probe-call","name":"get_ferry_schedule","arguments":{"terminal":"sekupang"},"output":{"schedules":[]}}]','[]');
  replay:=public.oracle_reserve_turn(request_id,'Synthetic lifecycle probe',NULL);
  IF replay->>'outcome'<>'completed' OR NOT (replay->>'replay')::boolean OR replay->>'assistant_message_id'<>turn->>'assistant_message_id' THEN
    RAISE EXCEPTION 'Saved replay failed'; END IF; checks:=checks+1;
  denied:=false;
  BEGIN PERFORM public.oracle_reserve_turn(request_id,'Changed content',NULL);
  EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Changed retry allowed'; END IF; checks:=checks+1;
  PERFORM set_config('request.jwt.claim.sub',user_b::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',user_b,'role','authenticated')::text,true);
  denied:=false;
  BEGIN PERFORM public.oracle_reserve_turn(gen_random_uuid(),'Foreign conversation',(turn->>'conversation_id')::uuid);
  EXCEPTION WHEN SQLSTATE 'PT404' THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Foreign conversation allowed'; END IF; checks:=checks+1;
  denied:=false;
  BEGIN PERFORM public.oracle_finish_turn((turn->>'turn_id')::uuid,'Foreign save','completed','[]','[]');
  EXCEPTION WHEN SQLSTATE 'PT404' THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Foreign save allowed'; END IF; checks:=checks+1;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{}',true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  denied:=false;
  BEGIN PERFORM public.oracle_reserve_turn(gen_random_uuid(),'Claimless',NULL);
  EXCEPTION WHEN SQLSTATE 'PT401' THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Claimless reservation allowed'; END IF; checks:=checks+1;
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  denied:=false;
  BEGIN PERFORM public.oracle_reserve_turn(gen_random_uuid(),'Anonymous',NULL);
  EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Anonymous execute allowed'; END IF; checks:=checks+1;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('oracle_lifecycle_probe.checks',checks::text,true);
END;
$$;
SELECT jsonb_build_object('checks_passed',current_setting('oracle_lifecycle_probe.checks')::integer,
  'scope','Installed RPCs and RLS with simulated claims','persistent_test_data','none; rolled back') AS probe;
ROLLBACK;
