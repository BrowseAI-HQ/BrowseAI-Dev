-- Add user tracking to browse_results
-- Allows per-user query history and usage stats

ALTER TABLE browse_results ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE browse_results ADD COLUMN IF NOT EXISTS tool TEXT DEFAULT 'answer';

CREATE INDEX IF NOT EXISTS idx_browse_results_user ON browse_results(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Users can read their own results
CREATE POLICY "Users read own results"
  ON browse_results FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);
