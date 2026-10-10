BEGIN TRANSACTION READ ONLY;
SELECT jsonb_build_object(
  'conversations',(SELECT count(*) FROM public.conversations),
  'chat_messages',(SELECT count(*) FROM public.chat_messages),
  'duplicate_tool_calls',(SELECT count(*) FROM (
    SELECT turn_id,tool_call_id FROM public.chat_messages WHERE role='tool'
    GROUP BY turn_id,tool_call_id HAVING count(*)>1) d),
  'functions',(SELECT coalesce(jsonb_agg(x ORDER BY function_name),'[]'::jsonb) FROM (
    SELECT p.proname AS function_name,p.prosecdef AS security_definer,p.proconfig AS settings,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'oracle_%') x)
) AS audit;
COMMIT;
