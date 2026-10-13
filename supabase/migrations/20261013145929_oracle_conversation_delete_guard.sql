-- Existing owner DELETE policies and message cascades remain unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.oracle_guard_active_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- DELETE locks the conversation row, serializing with the turn RPCs that
  -- lock the same row. Stale turns use the existing three-minute threshold.
  IF EXISTS (
    SELECT 1 FROM public.chat_messages
    WHERE conversation_id=OLD.id AND user_id=OLD.user_id AND role='assistant'
      AND status='in_progress' AND created_at>now()-interval '3 minutes'
  ) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='Wait for the active turn before deleting';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER oracle_active_delete BEFORE DELETE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.oracle_guard_active_delete();
REVOKE ALL ON FUNCTION public.oracle_guard_active_delete() FROM PUBLIC,anon,authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
