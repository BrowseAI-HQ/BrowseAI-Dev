-- User API keys for hosted key model
-- Users save their Tavily + OpenRouter keys once, get a single BrowseAI Dev API key (bai_xxx)

CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_hash TEXT NOT NULL UNIQUE,
  api_key_prefix TEXT NOT NULL,
  tavily_key_encrypted TEXT NOT NULL,
  tavily_key_iv TEXT NOT NULL,
  openrouter_key_encrypted TEXT NOT NULL,
  openrouter_key_iv TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false
);

-- Fast lookup by hash (hot path on every API request with bai_xxx key)
CREATE INDEX idx_user_api_keys_hash ON user_api_keys(api_key_hash) WHERE revoked = false;

-- List keys by user
CREATE INDEX idx_user_api_keys_user ON user_api_keys(user_id);

-- Row Level Security
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- Users can read their own keys
CREATE POLICY "Users read own keys"
  ON user_api_keys FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own keys
CREATE POLICY "Users insert own keys"
  ON user_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own keys (revocation)
CREATE POLICY "Users update own keys"
  ON user_api_keys FOR UPDATE
  USING (auth.uid() = user_id);
