-- Run only against the inspected project after the history schema exists.
-- Uses two existing user IDs internally; no login, account changes, or user
-- records are returned. All synthetic history rows and temp objects roll back.
BEGIN;
CREATE TEMP TABLE oracle_probe_state ON COMMIT DROP AS
WITH users AS (SELECT ARRAY(SELECT id FROM auth.users ORDER BY id LIMIT 2) AS ids)
SELECT ids[1] AS a, ids[2] AS b, gen_random_uuid() AS ca, gen_random_uuid() AS cb,
       gen_random_uuid() AS ma, gen_random_uuid() AS mb,
       gen_random_uuid() AS ra, gen_random_uuid() AS rb FROM users;
CREATE TEMP TABLE oracle_probe_results (check_name text, passed boolean) ON COMMIT DROP;
GRANT SELECT ON oracle_probe_state TO authenticated;
GRANT INSERT, SELECT ON oracle_probe_results TO authenticated;

DO $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM oracle_probe_state;
  IF s.a IS NULL OR s.b IS NULL THEN RAISE EXCEPTION 'Two existing identities required'; END IF;
  INSERT INTO public.conversations(id,user_id,title) VALUES (s.ca,s.a,'Oracle policy probe A'),(s.cb,s.b,'Oracle policy probe B');
  INSERT INTO public.chat_messages(id,conversation_id,user_id,turn_id,client_request_id,role,content,status)
  VALUES (s.ma,s.ca,s.a,s.ma,s.ra,'user','Synthetic policy probe','completed'),
         (s.mb,s.cb,s.b,s.mb,s.rb,'user','Synthetic policy probe','completed');
END $$;

SELECT set_config('request.jwt.claim.sub', a::text, true) FROM oracle_probe_state;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub',a,'role','authenticated')::text, true) FROM oracle_probe_state;
SET LOCAL ROLE authenticated;

DO $$
DECLARE s record; changed integer; denied boolean; mid uuid;
BEGIN
  SELECT * INTO s FROM oracle_probe_state;
  IF auth.uid() <> s.a THEN RAISE EXCEPTION 'Auth identity mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversations WHERE id=s.ca)
     OR EXISTS(SELECT 1 FROM public.conversations WHERE id=s.cb)
     OR EXISTS(SELECT 1 FROM public.chat_messages WHERE id=s.mb)
  THEN RAISE EXCEPTION 'Ownership select failed'; END IF;
  INSERT INTO oracle_probe_results VALUES ('user_a_select_isolation',true);

  UPDATE public.conversations SET title='denied' WHERE id=s.cb;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Foreign update allowed'; END IF;
  DELETE FROM public.conversations WHERE id=s.cb;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Foreign delete allowed'; END IF;
  UPDATE public.chat_messages SET content='denied' WHERE id=s.mb;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Foreign message update allowed'; END IF;
  DELETE FROM public.chat_messages WHERE id=s.mb;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Foreign message delete allowed'; END IF;
  INSERT INTO oracle_probe_results VALUES ('foreign_update_delete_isolation',true);

  denied := false;
  BEGIN
    mid := gen_random_uuid();
    INSERT INTO public.chat_messages(id,conversation_id,user_id,turn_id,client_request_id,role,content)
    VALUES(mid,s.cb,s.a,mid,gen_random_uuid(),'user','denied');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Foreign append allowed'; END IF;
  INSERT INTO oracle_probe_results VALUES ('foreign_append_denied',true);

  denied := false;
  BEGIN
    INSERT INTO public.conversations(user_id) VALUES(s.b);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Forged owner allowed'; END IF;
  INSERT INTO oracle_probe_results VALUES ('forged_owner_denied',true);

  denied := false;
  BEGIN
    UPDATE public.conversations SET user_id=s.b WHERE id=s.ca;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Conversation owner transfer allowed'; END IF;
  denied := false;
  BEGIN
    UPDATE public.chat_messages SET user_id=s.b WHERE id=s.ma;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Message owner transfer allowed'; END IF;
  INSERT INTO oracle_probe_results VALUES ('owner_transfer_denied',true);

  mid := gen_random_uuid();
  INSERT INTO public.chat_messages(id,conversation_id,user_id,turn_id,client_request_id,role,content)
  VALUES(mid,s.ca,s.a,mid,gen_random_uuid(),'user','allowed');
  INSERT INTO oracle_probe_results VALUES ('own_append_allowed',true);

  denied := false;
  BEGIN
    mid := gen_random_uuid();
    INSERT INTO public.chat_messages(id,conversation_id,user_id,turn_id,client_request_id,role,content)
    VALUES(mid,s.ca,s.a,mid,s.ra,'user','duplicate');
  EXCEPTION WHEN unique_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Duplicate request allowed'; END IF;
  INSERT INTO oracle_probe_results VALUES ('duplicate_retry_denied',true);

  UPDATE public.conversations SET archived_at=now() WHERE id=s.ca;
  denied := false;
  BEGIN
    mid := gen_random_uuid();
    INSERT INTO public.chat_messages(id,conversation_id,user_id,turn_id,client_request_id,role,content)
    VALUES(mid,s.ca,s.a,mid,gen_random_uuid(),'user','archived');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Archived append allowed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.chat_messages WHERE id=s.ma) THEN RAISE EXCEPTION 'Archive lost history'; END IF;
  INSERT INTO oracle_probe_results VALUES ('archive_append_denied_history_preserved',true);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', b::text, true) FROM oracle_probe_state;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub',b,'role','authenticated')::text, true) FROM oracle_probe_state;
SET LOCAL ROLE authenticated;
DO $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM oracle_probe_state;
  IF auth.uid() <> s.b OR EXISTS(SELECT 1 FROM public.conversations WHERE id=s.ca)
     OR EXISTS(SELECT 1 FROM public.chat_messages WHERE id=s.ma)
     OR NOT EXISTS(SELECT 1 FROM public.conversations WHERE id=s.cb)
     OR NOT EXISTS(SELECT 1 FROM public.chat_messages WHERE id=s.mb)
  THEN RAISE EXCEPTION 'User B isolation failed'; END IF;
  INSERT INTO oracle_probe_results VALUES ('user_b_select_isolation',true);
END $$;

RESET ROLE;
DO $$
BEGIN
  IF has_table_privilege('anon','public.conversations','SELECT')
     OR has_table_privilege('anon','public.chat_messages','SELECT')
     OR has_table_privilege('anon','public.conversations','INSERT')
     OR has_table_privilege('anon','public.chat_messages','INSERT')
  THEN RAISE EXCEPTION 'Anonymous privileges exposed'; END IF;
  INSERT INTO oracle_probe_results VALUES ('anonymous_privileges_denied',true);
END $$;
SELECT jsonb_build_object('checks',jsonb_agg(jsonb_build_object('name',check_name,'passed',passed)),
    'scope','Direct database roles/claims with existing identities; no valid JWT login tested; synthetic rows rolled back') AS audit
FROM oracle_probe_results;
ROLLBACK;
