-- ============================================================================
-- Context Pack - Supabase Database Schema & Security Policies
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. CONTEXT_PACKS (Current active head for each user/platform/chat)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.context_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    platform TEXT NOT NULL CHECK (platform IN ('claude', 'chatgpt', 'gemini')),
    external_chat_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Başlıksız Sohbet',
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    
    -- Structured JSONB context
    pack JSONB NOT NULL DEFAULT '{
        "decisions": [],
        "architecture": {},
        "open_questions": [],
        "latest_code": []
    }'::jsonb,
    
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Unique constraint per user, platform and chat session
    CONSTRAINT uq_context_packs_user_platform_chat UNIQUE (user_id, platform, external_chat_id),

    -- JSON structure validation
    CONSTRAINT chk_context_pack_structure CHECK (
        jsonb_typeof(pack) = 'object' AND
        pack ? 'decisions' AND jsonb_typeof(pack->'decisions') = 'array' AND
        pack ? 'architecture' AND jsonb_typeof(pack->'architecture') = 'object' AND
        pack ? 'open_questions' AND jsonb_typeof(pack->'open_questions') = 'array' AND
        pack ? 'latest_code' AND jsonb_typeof(pack->'latest_code') = 'array'
    )
);

ALTER TABLE public.context_packs ALTER COLUMN pack SET STORAGE EXTENDED;

-- ----------------------------------------------------------------------------
-- 2. CONTEXT_PACK_REVISIONS (Append-only version history)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.context_pack_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES public.context_packs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    pack JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    change_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_context_pack_revisions_pack_version UNIQUE (pack_id, version)
);

-- ----------------------------------------------------------------------------
-- 2.1 CONTEXT_PACK_LINKS (Associates platform chats with a single Context Pack)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.context_pack_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    pack_id UUID NOT NULL REFERENCES public.context_packs(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('claude', 'chatgpt', 'gemini')),
    external_chat_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_context_pack_links_user_platform_chat UNIQUE (user_id, platform, external_chat_id)
);

-- ----------------------------------------------------------------------------
-- 3. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_context_packs_user_platform 
    ON public.context_packs (user_id, platform);

CREATE INDEX IF NOT EXISTS idx_context_packs_pack_gin 
    ON public.context_packs USING gin (pack jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_context_packs_metadata 
    ON public.context_packs USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_context_pack_revisions_pack 
    ON public.context_pack_revisions (pack_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_context_pack_revisions_user 
    ON public.context_pack_revisions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_context_pack_links_pack 
    ON public.context_pack_links (pack_id);

CREATE INDEX IF NOT EXISTS idx_context_pack_links_user_chat 
    ON public.context_pack_links (user_id, platform, external_chat_id);

-- ----------------------------------------------------------------------------
-- 4. TRIGGERS & FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_context_packs_updated_at ON public.context_packs;
CREATE TRIGGER tr_context_packs_updated_at
    BEFORE UPDATE ON public.context_packs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Automatic Revision Snapshotting Trigger
CREATE OR REPLACE FUNCTION public.archive_context_pack_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.context_pack_revisions (
        pack_id,
        user_id,
        version,
        pack,
        metadata,
        change_summary,
        created_at
    ) VALUES (
        NEW.id,
        NEW.user_id,
        NEW.version,
        NEW.pack,
        NEW.metadata,
        NEW.metadata->>'change_summary',
        NEW.updated_at
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_context_packs_archive_revision ON public.context_packs;
CREATE TRIGGER tr_context_packs_archive_revision
    AFTER INSERT OR UPDATE ON public.context_packs
    FOR EACH ROW
    EXECUTE FUNCTION public.archive_context_pack_revision();

-- ----------------------------------------------------------------------------
-- 5. ATOMIC UPSERT RPC (Optimistic Concurrency Control + Chat Linking)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_context_pack_atomic(TEXT, TEXT, TEXT, JSONB, JSONB, INTEGER);
DROP FUNCTION IF EXISTS public.save_context_pack_atomic(TEXT, TEXT, TEXT, JSONB, JSONB, INTEGER, UUID);

CREATE OR REPLACE FUNCTION public.save_context_pack_atomic(
    p_platform TEXT,
    p_external_chat_id TEXT,
    p_title TEXT,
    p_pack JSONB,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_expected_version INTEGER DEFAULT NULL,
    p_pack_id UUID DEFAULT NULL
)
RETURNS public.context_packs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
    v_current_pack public.context_packs%ROWTYPE;
    v_result public.context_packs%ROWTYPE;
    v_target_pack_id UUID := p_pack_id;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    -- 1. If pack ID not explicitly passed, check if this chat is already linked to a pack
    IF v_target_pack_id IS NULL THEN
        SELECT pack_id INTO v_target_pack_id
        FROM public.context_pack_links
        WHERE user_id = v_user_id
          AND platform = p_platform
          AND external_chat_id = p_external_chat_id;
    END IF;

    -- 2. Find target pack (either by linked ID or fallback by origin platform & chat)
    IF v_target_pack_id IS NOT NULL THEN
        SELECT * INTO v_current_pack
        FROM public.context_packs
        WHERE id = v_target_pack_id AND user_id = v_user_id
        FOR UPDATE;
    ELSE
        SELECT * INTO v_current_pack
        FROM public.context_packs
        WHERE user_id = v_user_id 
          AND platform = p_platform 
          AND external_chat_id = p_external_chat_id
        FOR UPDATE;
    END IF;

    -- 3. Update existing or insert new
    IF v_current_pack.id IS NOT NULL THEN
        -- Check OCC version if client provided one
        IF p_expected_version IS NOT NULL AND v_current_pack.version != p_expected_version THEN
            RAISE EXCEPTION 'Version conflict: expected %, found %', 
                p_expected_version, v_current_pack.version 
                USING ERRCODE = 'P0001';
        END IF;

        UPDATE public.context_packs
        SET title = COALESCE(NULLIF(p_title, ''), v_current_pack.title),
            version = v_current_pack.version + 1,
            pack = p_pack,
            metadata = p_metadata
        WHERE id = v_current_pack.id
        RETURNING * INTO v_result;

        -- Ensure this chat is recorded in links
        INSERT INTO public.context_pack_links (user_id, pack_id, platform, external_chat_id)
        VALUES (v_user_id, v_result.id, p_platform, p_external_chat_id)
        ON CONFLICT (user_id, platform, external_chat_id)
        DO UPDATE SET pack_id = EXCLUDED.pack_id;
    ELSE
        INSERT INTO public.context_packs (
            user_id,
            platform,
            external_chat_id,
            title,
            version,
            pack,
            metadata
        ) VALUES (
            v_user_id,
            p_platform,
            p_external_chat_id,
            COALESCE(NULLIF(p_title, ''), 'Başlıksız Sohbet'),
            1,
            p_pack,
            p_metadata
        )
        RETURNING * INTO v_result;

        -- Auto-link the creating chat to the new pack
        INSERT INTO public.context_pack_links (user_id, pack_id, platform, external_chat_id)
        VALUES (v_user_id, v_result.id, p_platform, p_external_chat_id)
        ON CONFLICT (user_id, platform, external_chat_id)
        DO UPDATE SET pack_id = EXCLUDED.pack_id;
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5.1 CHAT LINKING RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_chat_to_pack(
    p_pack_id UUID,
    p_platform TEXT,
    p_external_chat_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    INSERT INTO public.context_pack_links (user_id, pack_id, platform, external_chat_id)
    VALUES (v_user_id, p_pack_id, p_platform, p_external_chat_id)
    ON CONFLICT (user_id, platform, external_chat_id)
    DO UPDATE SET pack_id = EXCLUDED.pack_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unlink_chat_from_pack(
    p_platform TEXT,
    p_external_chat_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    DELETE FROM public.context_pack_links
    WHERE user_id = v_user_id
      AND platform = p_platform
      AND external_chat_id = p_external_chat_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.context_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.context_packs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.context_pack_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.context_pack_revisions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.context_pack_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.context_pack_links FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own context packs" ON public.context_packs;
CREATE POLICY "Users can view their own context packs"
    ON public.context_packs FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own context packs" ON public.context_packs;
CREATE POLICY "Users can insert their own context packs"
    ON public.context_packs FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own context packs" ON public.context_packs;
CREATE POLICY "Users can update their own context packs"
    ON public.context_packs FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own context packs" ON public.context_packs;
CREATE POLICY "Users can delete their own context packs"
    ON public.context_packs FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Revisions: Read-only for authenticated user, mutations happen through triggers
DROP POLICY IF EXISTS "Users can view their own revisions" ON public.context_pack_revisions;
CREATE POLICY "Users can view their own revisions"
    ON public.context_pack_revisions FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users cannot manually mutate revisions" ON public.context_pack_revisions;
CREATE POLICY "Users cannot manually mutate revisions"
    ON public.context_pack_revisions FOR ALL TO authenticated
    USING (false);

-- Links: Full access for own user
DROP POLICY IF EXISTS "Users can view their own links" ON public.context_pack_links;
CREATE POLICY "Users can view their own links"
    ON public.context_pack_links FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own links" ON public.context_pack_links;
CREATE POLICY "Users can insert their own links"
    ON public.context_pack_links FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own links" ON public.context_pack_links;
CREATE POLICY "Users can update their own links"
    ON public.context_pack_links FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own links" ON public.context_pack_links;
CREATE POLICY "Users can delete their own links"
    ON public.context_pack_links FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

