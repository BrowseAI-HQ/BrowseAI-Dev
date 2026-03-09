CREATE TABLE IF NOT EXISTS browse_results (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  query TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_browse_results_created ON browse_results(created_at DESC);

ALTER TABLE browse_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read results" ON browse_results FOR SELECT USING (true);
CREATE POLICY "Service role can insert" ON browse_results FOR INSERT WITH CHECK (true);
