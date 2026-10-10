-- JWT-owned atomic turn reservation, tool records, and terminal persistence.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE FUNCTION public.oracle_reserve_turn(p_request_id uuid,p_content text,p_conversation_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET lock_timeout = '5s' AS $$
DECLARE
  owner_id uuid := auth.uid();
  convo public.conversations%ROWTYPE;
  user_msg public.chat_messages%ROWTYPE;
  assistant public.chat_messages%ROWTYPE;
  new_turn uuid := gen_random_uuid();
  replay boolean := false;
BEGIN
  IF owner_id IS NULL THEN RAISE SQLSTATE 'PT401' USING MESSAGE='Authentication required'; END IF;
  IF p_request_id IS NULL OR p_content IS NULL OR char_length(btrim(p_content)) NOT BETWEEN 1 AND 8000 THEN
    RAISE SQLSTATE 'PT422' USING MESSAGE='Invalid turn request';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text || p_request_id::text,0));
  SELECT * INTO user_msg FROM public.chat_messages WHERE user_id=owner_id AND client_request_id=p_request_id AND role='user';
  IF FOUND THEN
    IF user_msg.content<>btrim(p_content) OR (p_conversation_id IS NOT NULL AND p_conversation_id<>user_msg.conversation_id) THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE='Request ID belongs to a different turn';
    END IF;
    SELECT * INTO convo FROM public.conversations WHERE id=user_msg.conversation_id AND user_id=owner_id FOR UPDATE;
    IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Conversation not found'; END IF;
    SELECT * INTO assistant FROM public.chat_messages WHERE turn_id=user_msg.id AND user_id=owner_id AND role='assistant' FOR UPDATE;
    IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Turn state unavailable'; END IF;
    IF assistant.status='in_progress' THEN
      IF convo.archived_at IS NOT NULL THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Conversation is archived'; END IF;
      IF assistant.created_at>now()-interval '3 minutes' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Turn is already in progress'; END IF;
      UPDATE public.chat_messages SET status='interrupted' WHERE turn_id=user_msg.id AND user_id=owner_id AND role IN ('user','assistant');
      assistant.status := 'interrupted';
    END IF;
    replay := true;
  ELSE
    IF p_conversation_id IS NULL THEN
      INSERT INTO public.conversations(user_id,title) VALUES(owner_id,left(btrim(p_content),80)) RETURNING * INTO convo;
    ELSE
      SELECT * INTO convo FROM public.conversations WHERE id=p_conversation_id AND user_id=owner_id FOR UPDATE;
      IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Conversation not found'; END IF;
    END IF;
    IF convo.archived_at IS NOT NULL THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Conversation is archived'; END IF;
    IF EXISTS(SELECT 1 FROM public.chat_messages WHERE conversation_id=convo.id AND user_id=owner_id
      AND role='assistant' AND status='in_progress' AND created_at>now()-interval '3 minutes') THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE='Conversation already has an active turn';
    END IF;
    UPDATE public.chat_messages SET status='interrupted' WHERE conversation_id=convo.id AND user_id=owner_id
      AND role IN ('user','assistant') AND status='in_progress';
    INSERT INTO public.chat_messages(id,conversation_id,user_id,turn_id,client_request_id,role,content)
      VALUES(new_turn,convo.id,owner_id,new_turn,p_request_id,'user',btrim(p_content)) RETURNING * INTO user_msg;
    INSERT INTO public.chat_messages(conversation_id,user_id,turn_id,role)
      VALUES(convo.id,owner_id,new_turn,'assistant') RETURNING * INTO assistant;
    UPDATE public.conversations SET title=coalesce(title,left(btrim(p_content),80)),updated_at=now() WHERE id=convo.id AND user_id=owner_id;
  END IF;
  RETURN jsonb_build_object('conversation_id',convo.id,'turn_id',user_msg.id,'user_message_id',user_msg.id,
    'assistant_message_id',assistant.id,'replay',replay,'outcome',assistant.status,'content',assistant.content,
    'tool_calls',assistant.tool_calls,'results',assistant.structured_results);
END;
$$;

CREATE FUNCTION public.oracle_record_tool(p_turn_id uuid,p_call_id text,p_name text,p_arguments jsonb,p_output jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET lock_timeout = '5s' AS $$
DECLARE
  owner_id uuid := auth.uid();
  convo_id uuid;
BEGIN
  IF owner_id IS NULL THEN RAISE SQLSTATE 'PT401' USING MESSAGE='Authentication required'; END IF;
  SELECT c.id INTO convo_id FROM public.conversations c JOIN public.chat_messages m ON m.conversation_id=c.id
    WHERE m.id=p_turn_id AND m.role='user' AND m.user_id=owner_id AND c.user_id=owner_id FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Turn not found'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.chat_messages WHERE turn_id=p_turn_id AND user_id=owner_id AND role='assistant' AND status='in_progress') THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='Turn is no longer active';
  END IF;
  IF p_call_id IS NULL OR char_length(p_call_id) NOT BETWEEN 1 AND 200 OR p_name IS NULL
    OR p_name NOT IN ('get_congestion_level','get_ferry_schedule','get_optimal_route')
    OR p_arguments IS NULL OR jsonb_typeof(p_arguments)<>'object' OR octet_length(p_arguments::text)>8000
    OR p_output IS NULL OR jsonb_typeof(p_output)<>'object' OR octet_length(p_output::text)>16000 THEN
    RAISE SQLSTATE 'PT422' USING MESSAGE='Invalid tool record';
  END IF;
  IF (SELECT count(*) FROM public.chat_messages WHERE turn_id=p_turn_id AND user_id=owner_id AND role='tool')>=12 THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='Tool limit exceeded';
  END IF;
  INSERT INTO public.chat_messages(conversation_id,user_id,turn_id,role,status,tool_call_id,tool_name,tool_arguments,tool_result)
    VALUES(convo_id,owner_id,p_turn_id,'tool','completed',p_call_id,p_name,p_arguments,p_output);
END;
$$;

CREATE FUNCTION public.oracle_finish_turn(p_turn_id uuid,p_content text,p_status text,p_tool_calls jsonb,p_results jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET lock_timeout = '5s' AS $$
DECLARE
  owner_id uuid := auth.uid();
  convo_id uuid;
  assistant public.chat_messages%ROWTYPE;
BEGIN
  IF owner_id IS NULL THEN RAISE SQLSTATE 'PT401' USING MESSAGE='Authentication required'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('completed','failed','interrupted') OR p_content IS NULL
    OR char_length(p_content)>32000 OR (p_status='completed' AND char_length(btrim(p_content))=0)
    OR p_tool_calls IS NULL OR jsonb_typeof(p_tool_calls)<>'array' OR jsonb_array_length(p_tool_calls)>12
    OR p_results IS NULL OR jsonb_typeof(p_results)<>'array' OR jsonb_array_length(p_results)>12
    OR octet_length(p_tool_calls::text)>200000 OR octet_length(p_results::text)>200000 THEN
    RAISE SQLSTATE 'PT422' USING MESSAGE='Invalid terminal turn state';
  END IF;
  SELECT c.id INTO convo_id FROM public.conversations c JOIN public.chat_messages m ON m.conversation_id=c.id
    WHERE m.id=p_turn_id AND m.role='user' AND m.user_id=owner_id AND c.user_id=owner_id FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Turn not found'; END IF;
  SELECT * INTO assistant FROM public.chat_messages WHERE turn_id=p_turn_id AND user_id=owner_id AND role='assistant' FOR UPDATE;
  IF NOT FOUND OR assistant.status<>'in_progress' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Turn is no longer active'; END IF;
  UPDATE public.chat_messages SET content=p_content,status=p_status,tool_calls=p_tool_calls,structured_results=p_results
    WHERE id=assistant.id AND user_id=owner_id RETURNING * INTO assistant;
  UPDATE public.chat_messages SET status=p_status WHERE id=p_turn_id AND user_id=owner_id;
  UPDATE public.conversations SET updated_at=now() WHERE id=convo_id AND user_id=owner_id;
  RETURN jsonb_build_object('message_id',assistant.id,'outcome',assistant.status);
END;
$$;

CREATE FUNCTION public.oracle_guard_active_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL AND EXISTS(
    SELECT 1 FROM public.chat_messages WHERE conversation_id=OLD.id AND role='assistant'
      AND status='in_progress' AND created_at>now()-interval '3 minutes'
  ) THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Wait for the active turn before archiving'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER oracle_active_archive BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.oracle_guard_active_archive();
REVOKE ALL ON FUNCTION public.oracle_guard_active_archive() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oracle_reserve_turn(uuid,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.oracle_record_tool(uuid,text,text,jsonb,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.oracle_finish_turn(uuid,text,text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.oracle_reserve_turn(uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.oracle_record_tool(uuid,text,text,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.oracle_finish_turn(uuid,text,text,jsonb,jsonb) TO authenticated;
CREATE UNIQUE INDEX chat_messages_tool_call_once_idx ON public.chat_messages(turn_id,tool_call_id) WHERE role='tool';
NOTIFY pgrst,'reload schema';
COMMIT;
