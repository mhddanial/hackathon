-- Synthetic rows only, under existing identities. Everything rolls back.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TEMP TABLE oracle_delete_state ON COMMIT DROP AS
WITH users AS (SELECT ARRAY(SELECT id FROM auth.users ORDER BY id LIMIT 2) AS ids)
SELECT ids[1] AS a, ids[2] AS b, gen_random_uuid() AS ca,
       gen_random_uuid() AS cb, gen_random_uuid() AS archived FROM users;
CREATE TEMP TABLE oracle_delete_results (check_name text, passed boolean) ON COMMIT DROP;
GRANT SELECT ON oracle_delete_state TO authenticated;
GRANT INSERT, SELECT ON oracle_delete_results TO authenticated;
DO $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM oracle_delete_state;
  IF s.a IS NULL OR s.b IS NULL THEN RAISE EXCEPTION 'Two existing identities required'; END IF;
  INSERT INTO public.conversations(id,user_id,title,archived_at) VALUES
    (s.ca,s.a,'Synthetic delete probe',NULL),
    (s.cb,s.b,'Synthetic foreign delete probe',NULL),
    (s.archived,s.a,'Synthetic archived delete probe',now());
END $$;
SELECT set_config('request.jwt.claim.sub',a::text,true) FROM oracle_delete_state;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true) FROM oracle_delete_state;
SET LOCAL ROLE authenticated;
DO $$
DECLARE s record; turn jsonb; stale jsonb; changed integer; denied boolean := false;
BEGIN
  SELECT * INTO s FROM oracle_delete_state;
  DELETE FROM public.conversations WHERE id=s.cb;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Foreign deletion allowed'; END IF;
  INSERT INTO oracle_delete_results VALUES ('foreign_delete_denied',true);

  turn := public.oracle_reserve_turn(gen_random_uuid(),'Synthetic active delete probe',s.ca);
  BEGIN
    DELETE FROM public.conversations WHERE id=s.ca;
  EXCEPTION WHEN SQLSTATE 'PT409' THEN denied := true;
  END;
  IF NOT denied OR (SELECT count(*) FROM public.chat_messages WHERE conversation_id=s.ca)<>2
    THEN RAISE EXCEPTION 'Active deletion did not preserve the turn'; END IF;
  INSERT INTO oracle_delete_results VALUES ('active_delete_blocked_with_rows_preserved',true);

  PERFORM public.oracle_record_tool((turn->>'turn_id')::uuid,'delete-probe-call','get_ferry_schedule','{}','{}');
  PERFORM public.oracle_finish_turn((turn->>'turn_id')::uuid,'Synthetic complete answer','completed','[]','[]');
  DELETE FROM public.conversations WHERE id=s.ca;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed<>1 OR EXISTS(SELECT 1 FROM public.chat_messages WHERE conversation_id=s.ca)
    THEN RAISE EXCEPTION 'Completed deletion failed to cascade'; END IF;
  INSERT INTO oracle_delete_results VALUES ('completed_delete_cascades_user_assistant_tool',true);
  denied := false;
  BEGIN
    PERFORM public.oracle_finish_turn((turn->>'turn_id')::uuid,'Late answer','completed','[]','[]');
  EXCEPTION WHEN SQLSTATE 'PT404' THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Late persistence survived deletion'; END IF;
  INSERT INTO oracle_delete_results VALUES ('late_finish_rejected',true);

  DELETE FROM public.conversations WHERE id=s.archived;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Archived deletion failed'; END IF;
  INSERT INTO oracle_delete_results VALUES ('archived_delete_allowed',true);

  stale := public.oracle_reserve_turn(gen_random_uuid(),'Synthetic stale delete probe',NULL);
  UPDATE public.chat_messages SET created_at=now()-interval '4 minutes'
    WHERE conversation_id=(stale->>'conversation_id')::uuid;
  DELETE FROM public.conversations WHERE id=(stale->>'conversation_id')::uuid;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed<>1 OR EXISTS(SELECT 1 FROM public.chat_messages WHERE conversation_id=(stale->>'conversation_id')::uuid)
    THEN RAISE EXCEPTION 'Stale deletion failed'; END IF;
  INSERT INTO oracle_delete_results VALUES ('stale_delete_allowed_and_cascaded',true);
END $$;
RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.conversations WHERE id=(SELECT cb FROM oracle_delete_state))
    THEN RAISE EXCEPTION 'Foreign probe conversation changed'; END IF;
  IF has_table_privilege('anon','public.conversations','DELETE')
    THEN RAISE EXCEPTION 'Anonymous deletion exposed'; END IF;
  INSERT INTO oracle_delete_results VALUES ('foreign_rows_preserved_and_anonymous_delete_denied',true);
END $$;
SELECT jsonb_build_object('checks',jsonb_agg(jsonb_build_object('name',check_name,'passed',passed)),
  'scope','Direct database roles and simulated claims; synthetic history rolled back; no signed-in HTTP tested') AS verification
FROM oracle_delete_results;
ROLLBACK;
