-- Domain authority table: source of truth for domain trust scores.
-- Replaces hardcoded arrays. Supports curated overrides + bulk imports (Tranco, Majestic).
-- Dynamic scores from the data flywheel persist across restarts.

CREATE TABLE IF NOT EXISTS domain_authority (
  domain TEXT PRIMARY KEY,
  tier INTEGER NOT NULL DEFAULT -1,        -- 0-4 for curated, -1 for auto-scored from rank data
  static_score NUMERIC(4,2) NOT NULL DEFAULT 0.50,
  dynamic_score NUMERIC(4,2),              -- from verification data (data flywheel)
  sample_count INTEGER NOT NULL DEFAULT 0, -- queries contributing to dynamic_score
  global_rank INTEGER,                     -- from Tranco/Majestic import
  curated BOOLEAN NOT NULL DEFAULT false,  -- curated entries can't be overwritten by imports
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_domain_authority_tier ON domain_authority (tier);
CREATE INDEX IF NOT EXISTS idx_domain_authority_rank ON domain_authority (global_rank) WHERE global_rank IS NOT NULL;

-- RLS
ALTER TABLE domain_authority ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read domain authority" ON domain_authority FOR SELECT USING (true);
CREATE POLICY "Service role can manage domain authority" ON domain_authority FOR ALL USING (true);

-- ═══════════════════════════════════════════════════════════════
-- Seed curated domains (~260 domains across 5 tiers)
-- ═══════════════════════════════════════════════════════════════

-- Tier 4: Institutional / scientific (0.95)
INSERT INTO domain_authority (domain, tier, static_score, curated) VALUES
  -- TLDs (matched as suffixes)
  ('.gov', 4, 0.95, true),
  ('.edu', 4, 0.95, true),
  ('.mil', 4, 0.95, true),
  ('.ac.uk', 4, 0.95, true),
  ('.gov.uk', 4, 0.95, true),
  ('.gov.au', 4, 0.95, true),
  ('.gc.ca', 4, 0.95, true),
  ('.europa.eu', 4, 0.95, true),
  -- Science & health
  ('who.int', 4, 0.95, true),
  ('cdc.gov', 4, 0.95, true),
  ('nih.gov', 4, 0.95, true),
  ('nasa.gov', 4, 0.95, true),
  ('fda.gov', 4, 0.95, true),
  ('epa.gov', 4, 0.95, true),
  ('nature.com', 4, 0.95, true),
  ('science.org', 4, 0.95, true),
  ('sciencedirect.com', 4, 0.95, true),
  ('springer.com', 4, 0.95, true),
  ('pubmed.ncbi.nlm.nih.gov', 4, 0.95, true),
  ('ncbi.nlm.nih.gov', 4, 0.95, true),
  ('scholar.google.com', 4, 0.95, true),
  ('thelancet.com', 4, 0.95, true),
  ('bmj.com', 4, 0.95, true),
  ('nejm.org', 4, 0.95, true),
  ('cell.com', 4, 0.95, true),
  ('ieee.org', 4, 0.95, true),
  ('acm.org', 4, 0.95, true),
  ('arxiv.org', 4, 0.95, true),
  -- Standards bodies
  ('w3.org', 4, 0.95, true),
  ('ietf.org', 4, 0.95, true),
  ('iso.org', 4, 0.95, true),
  -- Top universities
  ('mit.edu', 4, 0.95, true),
  ('stanford.edu', 4, 0.95, true),
  ('harvard.edu', 4, 0.95, true),
  ('ox.ac.uk', 4, 0.95, true),
  ('cam.ac.uk', 4, 0.95, true),
  ('caltech.edu', 4, 0.95, true),
  ('berkeley.edu', 4, 0.95, true),
  ('cmu.edu', 4, 0.95, true),
  ('princeton.edu', 4, 0.95, true),
  ('yale.edu', 4, 0.95, true),
  ('columbia.edu', 4, 0.95, true),
  ('cornell.edu', 4, 0.95, true),
  ('uchicago.edu', 4, 0.95, true),
  ('eth.ch', 4, 0.95, true),
  ('epfl.ch', 4, 0.95, true),
  -- International organizations
  ('un.org', 4, 0.95, true),
  ('worldbank.org', 4, 0.95, true),
  ('imf.org', 4, 0.95, true),
  ('oecd.org', 4, 0.95, true),
  ('wto.org', 4, 0.95, true),
  -- More science journals
  ('plos.org', 4, 0.95, true),
  ('frontiersin.org', 4, 0.95, true),
  ('wiley.com', 4, 0.95, true),
  ('tandfonline.com', 4, 0.95, true),
  ('jstor.org', 4, 0.95, true),
  ('ssrn.com', 4, 0.95, true),
  ('researchgate.net', 4, 0.95, true),
  -- National research
  ('nist.gov', 4, 0.95, true),
  ('noaa.gov', 4, 0.95, true),
  ('energy.gov', 4, 0.95, true),
  ('nsf.gov', 4, 0.95, true)
ON CONFLICT (domain) DO NOTHING;

-- Tier 3: Major news & reference (0.85)
INSERT INTO domain_authority (domain, tier, static_score, curated) VALUES
  ('reuters.com', 3, 0.85, true),
  ('apnews.com', 3, 0.85, true),
  ('bbc.com', 3, 0.85, true),
  ('bbc.co.uk', 3, 0.85, true),
  ('nytimes.com', 3, 0.85, true),
  ('washingtonpost.com', 3, 0.85, true),
  ('theguardian.com', 3, 0.85, true),
  ('economist.com', 3, 0.85, true),
  ('ft.com', 3, 0.85, true),
  ('wsj.com', 3, 0.85, true),
  ('npr.org', 3, 0.85, true),
  ('pbs.org', 3, 0.85, true),
  ('aljazeera.com', 3, 0.85, true),
  ('dw.com', 3, 0.85, true),
  ('france24.com', 3, 0.85, true),
  ('abc.net.au', 3, 0.85, true),
  ('cbc.ca', 3, 0.85, true),
  ('scmp.com', 3, 0.85, true),
  ('japantimes.co.jp', 3, 0.85, true),
  ('thehindu.com', 3, 0.85, true),
  ('straitstimes.com', 3, 0.85, true),
  ('irishtimes.com', 3, 0.85, true),
  -- Reference
  ('wikipedia.org', 3, 0.85, true),
  ('britannica.com', 3, 0.85, true),
  ('merriam-webster.com', 3, 0.85, true),
  ('wikimedia.org', 3, 0.85, true),
  ('wikidata.org', 3, 0.85, true),
  -- Official docs
  ('developer.mozilla.org', 3, 0.85, true),
  ('docs.python.org', 3, 0.85, true),
  ('docs.microsoft.com', 3, 0.85, true),
  ('learn.microsoft.com', 3, 0.85, true),
  ('cloud.google.com', 3, 0.85, true),
  ('developer.apple.com', 3, 0.85, true),
  ('docs.aws.amazon.com', 3, 0.85, true),
  ('docs.oracle.com', 3, 0.85, true),
  ('docs.github.com', 3, 0.85, true),
  ('kubernetes.io', 3, 0.85, true),
  ('reactjs.org', 3, 0.85, true),
  ('vuejs.org', 3, 0.85, true),
  ('angular.io', 3, 0.85, true),
  ('typescriptlang.org', 3, 0.85, true),
  ('rust-lang.org', 3, 0.85, true),
  ('go.dev', 3, 0.85, true),
  ('python.org', 3, 0.85, true),
  ('docs.djangoproject.com', 3, 0.85, true),
  ('ruby-lang.org', 3, 0.85, true),
  ('docs.swift.org', 3, 0.85, true),
  ('kotlinlang.org', 3, 0.85, true),
  ('elixir-lang.org', 3, 0.85, true),
  ('haskell.org', 3, 0.85, true)
ON CONFLICT (domain) DO NOTHING;

-- Tier 2: Established tech & business (0.72)
INSERT INTO domain_authority (domain, tier, static_score, curated) VALUES
  ('techcrunch.com', 2, 0.72, true),
  ('arstechnica.com', 2, 0.72, true),
  ('wired.com', 2, 0.72, true),
  ('theverge.com', 2, 0.72, true),
  ('engadget.com', 2, 0.72, true),
  ('zdnet.com', 2, 0.72, true),
  ('cnet.com', 2, 0.72, true),
  ('tomshardware.com', 2, 0.72, true),
  ('anandtech.com', 2, 0.72, true),
  ('venturebeat.com', 2, 0.72, true),
  ('9to5mac.com', 2, 0.72, true),
  ('9to5google.com', 2, 0.72, true),
  ('macrumors.com', 2, 0.72, true),
  ('bleepingcomputer.com', 2, 0.72, true),
  ('stackoverflow.com', 2, 0.72, true),
  ('stackexchange.com', 2, 0.72, true),
  ('github.com', 2, 0.72, true),
  ('gitlab.com', 2, 0.72, true),
  ('npmjs.com', 2, 0.72, true),
  ('pypi.org', 2, 0.72, true),
  ('crates.io', 2, 0.72, true),
  ('hackernews.ycombinator.com', 2, 0.72, true),
  ('news.ycombinator.com', 2, 0.72, true),
  ('bloomberg.com', 2, 0.72, true),
  ('cnbc.com', 2, 0.72, true),
  ('forbes.com', 2, 0.72, true),
  ('fortune.com', 2, 0.72, true),
  ('businessinsider.com', 2, 0.72, true),
  ('marketwatch.com', 2, 0.72, true),
  ('openai.com', 2, 0.72, true),
  ('anthropic.com', 2, 0.72, true),
  ('huggingface.co', 2, 0.72, true),
  ('ai.google', 2, 0.72, true),
  ('blog.google', 2, 0.72, true),
  ('engineering.fb.com', 2, 0.72, true),
  ('aws.amazon.com', 2, 0.72, true),
  ('azure.microsoft.com', 2, 0.72, true),
  ('infoq.com', 2, 0.72, true),
  ('dzone.com', 2, 0.72, true),
  ('thenewstack.io', 2, 0.72, true),
  ('semianalysis.com', 2, 0.72, true),
  ('theregister.com', 2, 0.72, true),
  ('protocol.com', 2, 0.72, true),
  ('platformer.news', 2, 0.72, true),
  ('mayoclinic.org', 2, 0.72, true),
  ('clevelandclinic.org', 2, 0.72, true),
  ('hopkinsmedicine.org', 2, 0.72, true),
  ('medscape.com', 2, 0.72, true),
  ('uptodate.com', 2, 0.72, true),
  ('morningstar.com', 2, 0.72, true),
  ('seekingalpha.com', 2, 0.72, true),
  ('fool.com', 2, 0.72, true),
  ('law.cornell.edu', 2, 0.72, true),
  ('findlaw.com', 2, 0.72, true),
  ('scotusblog.com', 2, 0.72, true)
ON CONFLICT (domain) DO NOTHING;

-- Tier 1: Known decent sources (0.60)
INSERT INTO domain_authority (domain, tier, static_score, curated) VALUES
  ('medium.com', 1, 0.60, true),
  ('dev.to', 1, 0.60, true),
  ('hashnode.dev', 1, 0.60, true),
  ('substack.com', 1, 0.60, true),
  ('reddit.com', 1, 0.60, true),
  ('quora.com', 1, 0.60, true),
  ('linkedin.com', 1, 0.60, true),
  ('freecodecamp.org', 1, 0.60, true),
  ('css-tricks.com', 1, 0.60, true),
  ('smashingmagazine.com', 1, 0.60, true),
  ('digitalocean.com', 1, 0.60, true),
  ('linode.com', 1, 0.60, true),
  ('netlify.com', 1, 0.60, true),
  ('vercel.com', 1, 0.60, true),
  ('producthunt.com', 1, 0.60, true),
  ('crunchbase.com', 1, 0.60, true),
  ('glassdoor.com', 1, 0.60, true),
  ('investopedia.com', 1, 0.60, true),
  ('healthline.com', 1, 0.60, true),
  ('webmd.com', 1, 0.60, true),
  ('imdb.com', 1, 0.60, true),
  ('rottentomatoes.com', 1, 0.60, true),
  ('goodreads.com', 1, 0.60, true),
  ('baeldung.com', 1, 0.60, true),
  ('tutorialspoint.com', 1, 0.60, true),
  ('geeksforgeeks.org', 1, 0.60, true),
  ('javatpoint.com', 1, 0.60, true),
  ('w3schools.com', 1, 0.60, true),
  ('codecademy.com', 1, 0.60, true),
  ('coursera.org', 1, 0.60, true),
  ('edx.org', 1, 0.60, true),
  ('khanacademy.org', 1, 0.60, true),
  ('towardsdatascience.com', 1, 0.60, true),
  ('analyticsvidhya.com', 1, 0.60, true)
ON CONFLICT (domain) DO NOTHING;

-- Tier 0: Known low-quality (0.25)
INSERT INTO domain_authority (domain, tier, static_score, curated) VALUES
  ('tiktok.com', 0, 0.25, true),
  ('pinterest.com', 0, 0.25, true),
  ('ehow.com', 0, 0.25, true),
  ('answers.com', 0, 0.25, true),
  ('ask.com', 0, 0.25, true),
  ('wikihow.com', 0, 0.25, true),
  ('howstuffworks.com', 0, 0.25, true),
  ('buzzfeed.com', 0, 0.25, true),
  ('boredpanda.com', 0, 0.25, true),
  ('distractify.com', 0, 0.25, true),
  ('screenrant.com', 0, 0.25, true),
  ('cbr.com', 0, 0.25, true),
  ('gamerant.com', 0, 0.25, true),
  ('articlesbase.com', 0, 0.25, true),
  ('ezinearticles.com', 0, 0.25, true),
  ('hubpages.com', 0, 0.25, true),
  ('squidoo.com', 0, 0.25, true),
  ('helium.com', 0, 0.25, true),
  ('suite101.com', 0, 0.25, true),
  ('copyblogger.com', 0, 0.25, true),
  ('contentful.com', 0, 0.25, true),
  ('naturalnews.com', 0, 0.25, true),
  ('mercola.com', 0, 0.25, true),
  ('infowars.com', 0, 0.25, true),
  ('breitbart.com', 0, 0.25, true),
  ('dailymail.co.uk', 0, 0.25, true)
ON CONFLICT (domain) DO NOTHING;
