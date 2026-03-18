-- Research Memory: sessions + knowledge entries
-- Enables persistent, session-scoped research across multiple queries

-- Enable the pg_trgm extension FIRST (needed for GIN index below)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  claim_count INTEGER NOT NULL DEFAULT 0,
  query_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'Users can manage own sessions') THEN
    CREATE POLICY "Users can manage own sessions" ON sessions FOR ALL
      USING (auth.uid() = user_id OR user_id IS NULL)
      WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

-- Service role can do everything
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'Service role full access on sessions') THEN
    CREATE POLICY "Service role full access on sessions" ON sessions FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Knowledge entries: individual verified claims stored per session
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions ON DELETE CASCADE,
  claim TEXT NOT NULL,
  sources TEXT[] NOT NULL DEFAULT '{}',
  verified BOOLEAN NOT NULL DEFAULT false,
  confidence FLOAT NOT NULL DEFAULT 0,
  origin_query TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_session ON knowledge_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge_entries(session_id, created_at DESC);

-- GIN index for text search on claims
CREATE INDEX IF NOT EXISTS idx_knowledge_claim_trgm ON knowledge_entries USING gin (claim gin_trgm_ops);

-- Enable RLS
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;

-- Knowledge entries inherit access from their session
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_entries' AND policyname = 'Knowledge entries follow session access') THEN
    CREATE POLICY "Knowledge entries follow session access" ON knowledge_entries FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM sessions
          WHERE sessions.id = knowledge_entries.session_id
            AND (sessions.user_id = auth.uid() OR sessions.user_id IS NULL)
        )
      );
  END IF;
END $$;

-- Service role can do everything
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_entries' AND policyname = 'Service role full access on knowledge') THEN
    CREATE POLICY "Service role full access on knowledge" ON knowledge_entries FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Add session_id to browse_results for linking queries to sessions
ALTER TABLE browse_results ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_browse_results_session ON browse_results(session_id);

