-- Add source domain tracking and analytics columns to browse_results
ALTER TABLE browse_results
  ADD COLUMN IF NOT EXISTS source_domains TEXT[],
  ADD COLUMN IF NOT EXISTS response_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN DEFAULT false;

-- Index for domain analytics queries
CREATE INDEX IF NOT EXISTS idx_browse_results_source_domains
  ON browse_results USING GIN (source_domains);
