-- Additive history foundation. Never run backend/database/schema.sql to apply it.
-- Plain CREATE deliberately fails on name collisions; inspect/adapt first.
BEGIN;

CREATE TABLE public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    title text CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 160),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT conversations_id_owner UNIQUE (id, user_id)
);

CREATE INDEX conversations_owner_updated_idx
    ON public.conversations (user_id, updated_at DESC, id DESC);

CREATE TABLE public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL DEFAULT auth.uid(),
    turn_id uuid NOT NULL,
    client_request_id uuid,
    sequence bigint GENERATED ALWAYS AS IDENTITY,
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
    content text,
    status text NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'failed', 'interrupted')),
    tool_call_id text,
    tool_name text CHECK (tool_name IS NULL OR tool_name IN (
        'get_congestion_level', 'get_ferry_schedule', 'get_optimal_route'
    )),
    tool_arguments jsonb CHECK (tool_arguments IS NULL OR jsonb_typeof(tool_arguments) = 'object'),
    tool_result jsonb CHECK (tool_result IS NULL OR jsonb_typeof(tool_result) = 'object'),
    tool_calls jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tool_calls) = 'array'),
    structured_results jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(structured_results) = 'array'),
    data_status text CHECK (data_status IS NULL OR data_status IN (
        'synthetic_estimate', 'database', 'estimated', 'default_fallback', 'unknown'
    )),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chat_messages_conversation_owner FOREIGN KEY (conversation_id, user_id)
        REFERENCES public.conversations (id, user_id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_identity_owner UNIQUE (id, conversation_id, user_id),
    CONSTRAINT chat_messages_turn_owner FOREIGN KEY (turn_id, conversation_id, user_id)
        REFERENCES public.chat_messages (id, conversation_id, user_id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_request_once UNIQUE (user_id, client_request_id),
    CONSTRAINT chat_messages_order UNIQUE (conversation_id, sequence),
    CONSTRAINT chat_messages_user_turn CHECK (
        (role = 'user' AND id = turn_id AND client_request_id IS NOT NULL
            AND content IS NOT NULL AND char_length(btrim(content)) BETWEEN 1 AND 8000)
        OR (role <> 'user' AND id <> turn_id AND client_request_id IS NULL)
    ),
    CONSTRAINT chat_messages_tool_fields CHECK (
        role <> 'tool' OR (tool_call_id IS NOT NULL AND tool_name IS NOT NULL
            AND tool_arguments IS NOT NULL AND tool_result IS NOT NULL)
    ),
    CONSTRAINT chat_messages_completed_assistant CHECK (
        role <> 'assistant' OR status <> 'completed'
        OR (content IS NOT NULL AND char_length(btrim(content)) > 0)
    )
);

CREATE INDEX chat_messages_owner_conversation_idx ON public.chat_messages (user_id, conversation_id);
CREATE UNIQUE INDEX chat_messages_one_assistant_idx ON public.chat_messages (turn_id) WHERE role = 'assistant';

CREATE FUNCTION public.oracle_touch_conversation_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.oracle_touch_conversation_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER oracle_conversation_updated_at BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.oracle_touch_conversation_updated_at();

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.conversations, public.chat_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations, public.chat_messages TO authenticated;
REVOKE ALL ON SEQUENCE public.chat_messages_sequence_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.chat_messages_sequence_seq TO authenticated;

CREATE POLICY oracle_conversations_select ON public.conversations FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));
CREATE POLICY oracle_conversations_insert ON public.conversations FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY oracle_conversations_update ON public.conversations FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY oracle_conversations_delete ON public.conversations FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY oracle_messages_select ON public.chat_messages FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));
CREATE POLICY oracle_messages_insert ON public.chat_messages FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id AND c.user_id = (SELECT auth.uid()) AND c.archived_at IS NULL
    ));
CREATE POLICY oracle_messages_update ON public.chat_messages FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id AND c.user_id = (SELECT auth.uid()) AND c.archived_at IS NULL
    ));
CREATE POLICY oracle_messages_delete ON public.chat_messages FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

NOTIFY pgrst, 'reload schema';
COMMIT;
