import type { BrowseClaim, BrowseSource, Contradiction } from "@browse/shared";
import type { DomainAuthorityRow } from "../services/store.js";

// ─── Text Processing ────────────────────────────────────────────────

/** Normalize text for comparison: lowercase, strip punctuation, collapse whitespace. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split text into sentences using basic punctuation rules. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20); // Skip very short fragments
}

/** Tokenize text into words, filtering out stopwords and short tokens. */
function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(w => w.length > 2 && !STOPWORDS.has(w));
}

const STOPWORDS = new Set([
  "the", "and", "that", "this", "with", "from", "have", "has", "had",
  "was", "were", "are", "been", "being", "will", "would", "could",
  "should", "may", "might", "shall", "can", "for", "not", "but",
  "its", "also", "than", "then", "into", "over", "such", "only",
  "other", "more", "some", "any", "each", "about", "which", "when",
  "where", "what", "how", "who", "they", "them", "their", "there",
  "these", "those", "does", "did", "done", "doing", "just", "very",
]);

// ─── Negation detection ─────────────────────────────────────────────

const NEGATION_WORDS = new Set([
  "not", "no", "never", "neither", "nor", "none", "nothing",
  "nowhere", "cannot", "can't", "won't", "don't", "doesn't",
  "didn't", "isn't", "aren't", "wasn't", "weren't", "hasn't",
  "haven't", "hadn't", "wouldn't", "shouldn't", "couldn't",
  "unlikely", "false", "incorrect", "wrong", "impossible",
  "disproven", "debunked", "myth", "misconception",
]);

/** Count negation words in text. */
function countNegations(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  return words.filter(w => NEGATION_WORDS.has(w)).length;
}

// ─── BM25 Scoring ───────────────────────────────────────────────────

/** BM25 parameters */
const K1 = 1.5;
const B = 0.75;

/**
 * BM25 scorer: finds the best matching sentence in a document for a query.
 * Returns the score (0–1 normalized) and the matched sentence text.
 *
 * BM25 is the industry-standard ranking function used by Elasticsearch,
 * Lucene, and academic fact-checking pipelines (FEVER benchmark).
 */
function bm25BestSentence(
  query: string,
  document: string,
): { score: number; sentence: string | null } {
  const sentences = splitSentences(document);
  if (sentences.length === 0) return { score: 0, sentence: null };

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return { score: 0, sentence: null };

  // Compute document-level stats
  const sentenceTokens = sentences.map(s => tokenize(s));
  const avgDl = sentenceTokens.reduce((sum, t) => sum + t.length, 0) / sentenceTokens.length;

  // Compute IDF for query terms (across sentences as "documents")
  const N = sentenceTokens.length;
  const idf = new Map<string, number>();
  for (const term of queryTerms) {
    const df = sentenceTokens.filter(tokens => tokens.includes(term)).length;
    // BM25 IDF: log((N - df + 0.5) / (df + 0.5) + 1)
    idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
  }

  // Score each sentence
  let bestScore = 0;
  let bestIdx = -1;

  for (let i = 0; i < sentenceTokens.length; i++) {
    const tokens = sentenceTokens[i];
    const dl = tokens.length;
    let score = 0;

    // Count term frequencies in this sentence
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }

    for (const term of queryTerms) {
      const termFreq = tf.get(term) || 0;
      if (termFreq === 0) continue;

      const termIdf = idf.get(term) || 0;
      // BM25 TF component: (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl/avgdl))
      const tfNorm = (termFreq * (K1 + 1)) / (termFreq + K1 * (1 - B + B * dl / avgDl));
      score += termIdf * tfNorm;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestIdx === -1) return { score: 0, sentence: null };

  // Normalize score to 0–1 range
  const maxPossible = queryTerms.reduce((sum, t) => sum + (idf.get(t) || 0), 0) * (K1 + 1);
  const normalized = maxPossible > 0 ? Math.min(1, bestScore / maxPossible) : 0;

  return { score: normalized, sentence: sentences[bestIdx] };
}

/**
 * Hybrid verification: tries exact substring match first (fast path),
 * then falls back to BM25 sentence matching (more robust for paraphrases).
 */
function verifyTextInSource(
  claimText: string,
  sourceText: string,
): { score: number; matchedSentence: string | null } {
  // Fast path: exact normalized substring match
  const normalizedClaim = normalize(claimText);
  const normalizedSource = normalize(sourceText);
  if (normalizedClaim.length > 10 && normalizedSource.includes(normalizedClaim)) {
    return { score: 1.0, matchedSentence: claimText };
  }

  // BM25 sentence-level matching
  const { score, sentence } = bm25BestSentence(claimText, sourceText);
  return { score, matchedSentence: score >= 0.35 ? sentence : null };
}

// ─── Domain Authority ───────────────────────────────────────────────

const AUTHORITY: Record<string, number> = {};

// Tier 4: Institutional / scientific (0.95)
const T4 = [
  // TLDs
  ".gov", ".edu", ".mil", ".ac.uk", ".gov.uk", ".gov.au", ".gc.ca", ".europa.eu",
  // Science & health
  "who.int", "cdc.gov", "nih.gov", "nasa.gov", "fda.gov", "epa.gov",
  "nature.com", "science.org", "sciencedirect.com", "springer.com",
  "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "scholar.google.com",
  "thelancet.com", "bmj.com", "nejm.org", "cell.com",
  "ieee.org", "acm.org", "arxiv.org",
  // Standards bodies
  "w3.org", "ietf.org", "iso.org",
  // Top universities
  "mit.edu", "stanford.edu", "harvard.edu", "ox.ac.uk", "cam.ac.uk",
  "caltech.edu", "berkeley.edu", "cmu.edu", "princeton.edu", "yale.edu",
  "columbia.edu", "cornell.edu", "uchicago.edu", "eth.ch", "epfl.ch",
  // International organizations
  "un.org", "worldbank.org", "imf.org", "oecd.org", "wto.org",
  // More science journals
  "plos.org", "frontiersin.org", "wiley.com", "tandfonline.com",
  "jstor.org", "ssrn.com", "researchgate.net",
  // National academies & research
  "nist.gov", "noaa.gov", "energy.gov", "nsf.gov",
];

// Tier 3: Major news & reference (0.85)
const T3 = [
  // News
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk",
  "nytimes.com", "washingtonpost.com", "theguardian.com",
  "economist.com", "ft.com", "wsj.com", "npr.org", "pbs.org",
  "aljazeera.com", "dw.com", "france24.com",
  // More international news
  "abc.net.au", "cbc.ca", "scmp.com", "japantimes.co.jp",
  "thehindu.com", "straitstimes.com", "irishtimes.com",
  // Reference
  "wikipedia.org", "britannica.com", "merriam-webster.com",
  "wikimedia.org", "wikidata.org",
  // Official docs
  "developer.mozilla.org", "docs.python.org", "docs.microsoft.com",
  "learn.microsoft.com", "cloud.google.com", "developer.apple.com",
  "docs.aws.amazon.com", "docs.oracle.com", "docs.github.com",
  "kubernetes.io", "reactjs.org", "vuejs.org", "angular.io",
  "typescriptlang.org", "rust-lang.org", "go.dev", "python.org",
  // More official docs
  "docs.djangoproject.com", "ruby-lang.org", "docs.swift.org",
  "kotlinlang.org", "elixir-lang.org", "haskell.org",
];

// Tier 2: Established tech & business (0.72)
const T2 = [
  // Tech journalism
  "techcrunch.com", "arstechnica.com", "wired.com", "theverge.com",
  "engadget.com", "zdnet.com", "cnet.com", "tomshardware.com",
  "anandtech.com", "venturebeat.com", "9to5mac.com", "9to5google.com",
  "macrumors.com", "bleepingcomputer.com",
  // Developer community
  "stackoverflow.com", "stackexchange.com", "github.com",
  "gitlab.com", "npmjs.com", "pypi.org", "crates.io",
  "hackernews.ycombinator.com", "news.ycombinator.com",
  // Business news
  "bloomberg.com", "cnbc.com", "forbes.com", "fortune.com",
  "businessinsider.com", "marketwatch.com",
  // Major platforms
  "openai.com", "anthropic.com", "huggingface.co", "ai.google",
  "blog.google", "engineering.fb.com", "aws.amazon.com",
  "azure.microsoft.com",
  // More tech
  "infoq.com", "dzone.com", "thenewstack.io", "semianalysis.com",
  "theregister.com", "protocol.com", "platformer.news",
  // Health & medicine
  "mayoclinic.org", "clevelandclinic.org", "hopkinsmedicine.org",
  "medscape.com", "uptodate.com",
  // Finance
  "morningstar.com", "seekingalpha.com", "fool.com",
  // Legal & policy
  "law.cornell.edu", "findlaw.com", "scotusblog.com",
];

// Tier 1: Known decent sources (0.60)
const T1 = [
  "medium.com", "dev.to", "hashnode.dev", "substack.com",
  "reddit.com", "quora.com", "linkedin.com",
  "freecodecamp.org", "css-tricks.com", "smashingmagazine.com",
  "digitalocean.com", "linode.com", "netlify.com", "vercel.com",
  "producthunt.com", "crunchbase.com", "glassdoor.com",
  "investopedia.com", "healthline.com", "webmd.com",
  "imdb.com", "rottentomatoes.com", "goodreads.com",
  // More community/educational
  "baeldung.com", "tutorialspoint.com", "geeksforgeeks.org",
  "javatpoint.com", "w3schools.com", "codecademy.com",
  "coursera.org", "edx.org", "khanacademy.org",
  "towardsdatascience.com", "analyticsvidhya.com",
];

// Tier 0: Known low-quality (0.25)
const T0 = [
  "tiktok.com", "pinterest.com",
  // Content farms
  "ehow.com", "answers.com", "ask.com",
  "wikihow.com", "howstuffworks.com",
  // SEO spam / clickbait
  "buzzfeed.com", "boredpanda.com", "distractify.com",
  "screenrant.com", "cbr.com", "gamerant.com",
  // Low-quality aggregators
  "articlesbase.com", "ezinearticles.com", "hubpages.com",
  "squidoo.com", "helium.com", "suite101.com",
  // Auto-generated / scraped
  "copyblogger.com", "contentful.com",
  // Unreliable health/science
  "naturalnews.com", "mercola.com", "infowars.com",
  "breitbart.com", "dailymail.co.uk",
];

for (const d of T4) AUTHORITY[d] = 0.95;
for (const d of T3) AUTHORITY[d] = 0.85;
for (const d of T2) AUTHORITY[d] = 0.72;
for (const d of T1) AUTHORITY[d] = 0.60;
for (const d of T0) AUTHORITY[d] = 0.25;

const LOW_QUALITY_SET = new Set(T0);

/** Check if a URL belongs to a known low-quality domain (T0 tier). */
export function isLowQualityDomain(url: string): boolean {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    if (LOW_QUALITY_SET.has(domain)) return true;
    for (const d of LOW_QUALITY_SET) {
      if (d.startsWith(".") && domain.endsWith(d)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Initialize domain authority from database.
 * Loads all rows from domain_authority table and populates in-memory maps.
 * Falls back to hardcoded defaults if DB is empty or unavailable.
 */
export async function initDomainAuthority(
  loader: { loadDomainAuthority(): Promise<DomainAuthorityRow[]> }
): Promise<number> {
  try {
    const rows = await loader.loadDomainAuthority();
    if (rows.length === 0) return 0;

    // Clear and repopulate from DB
    for (const key of Object.keys(AUTHORITY)) delete AUTHORITY[key];
    LOW_QUALITY_SET.clear();

    for (const row of rows) {
      AUTHORITY[row.domain] = Number(row.static_score);
      if (row.tier === 0) LOW_QUALITY_SET.add(row.domain);
      if (row.dynamic_score != null && row.sample_count >= 3) {
        dynamicAuthority.set(row.domain, {
          dynamicScore: Number(row.dynamic_score),
          sampleCount: row.sample_count,
        });
      }
    }

    return rows.length;
  } catch (e) {
    console.warn("Failed to load domain authority from DB, using defaults:", e);
    return 0;
  }
}

// ─── Dynamic Authority (Bayesian smoothing) ─────────────────────────

/**
 * In-memory cache for dynamic domain authority scores.
 * Populated by admin recalculation endpoint, persists for process lifetime.
 * Map: domain → { dynamicScore, sampleCount }
 */
const dynamicAuthority = new Map<string, { dynamicScore: number; sampleCount: number }>();

/**
 * Bayesian prior weight — controls cold start behavior.
 * With PRIOR_WEIGHT=15, a domain needs ~15 samples before dynamic
 * data carries equal weight to the static tier score.
 * This means: new domains keep their static score until we have enough
 * evidence to adjust, smoothly transitioning to data-driven scores.
 */
const PRIOR_WEIGHT = 15;

/** Update the dynamic authority cache (called by admin recalculation). */
export function setDynamicAuthority(
  stats: Array<{ domain: string; verificationRate: number; sampleCount: number }>
) {
  dynamicAuthority.clear();
  for (const s of stats) {
    dynamicAuthority.set(s.domain, {
      dynamicScore: s.verificationRate,
      sampleCount: s.sampleCount,
    });
  }
}

/** Get the static authority score for a domain (from tier list). */
function getStaticAuthority(domain: string): number {
  const d = domain.toLowerCase().replace(/^www\./, "");

  if (AUTHORITY[d] !== undefined) return AUTHORITY[d];

  for (const [suffix, score] of Object.entries(AUTHORITY)) {
    if (suffix.startsWith(".") && d.endsWith(suffix)) return score;
  }

  return 0.5;
}

/**
 * Get domain authority score (0–1) with Bayesian cold-start smoothing.
 *
 * Formula: blended = (static * PRIOR_WEIGHT + dynamic * sampleCount) / (PRIOR_WEIGHT + sampleCount)
 *
 * - Cold start (0 samples): returns static score exactly
 * - Low data (5 samples): ~75% static, ~25% dynamic
 * - Medium data (15 samples): ~50% static, ~50% dynamic
 * - High data (50+ samples): ~23% static, ~77% dynamic
 *
 * This self-improving: every query contributes data, making future scores more accurate.
 */
export function getDomainAuthority(domain: string): number {
  const d = domain.toLowerCase().replace(/^www\./, "");
  const staticScore = getStaticAuthority(d);

  const dynamic = dynamicAuthority.get(d);
  if (!dynamic || dynamic.sampleCount < 3) {
    return staticScore; // Not enough data — use static
  }

  // Bayesian smoothing
  const blended = (staticScore * PRIOR_WEIGHT + dynamic.dynamicScore * dynamic.sampleCount)
    / (PRIOR_WEIGHT + dynamic.sampleCount);

  return Math.round(blended * 100) / 100;
}

// ─── Consensus Scoring (Phase 2) ────────────────────────────────────

/**
 * Compute token overlap ratio between two texts.
 * Returns a value between 0 and 1, where 1 means identical tokens.
 */
function tokenOverlap(textA: string, textB: string): number {
  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  // Jaccard similarity
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? overlap / union : 0;
}

/**
 * Cross-source consensus: for each claim, check how many independent
 * sources (from different domains) support it, even if the LLM didn't cite them.
 *
 * A claim verified by 3+ independent domains is much more trustworthy
 * than one backed by a single source.
 */
function computeConsensus(
  claimText: string,
  pageContents: Map<string, string>,
  sources: BrowseSource[],
): { count: number; level: "strong" | "moderate" | "weak" | "none" } {
  const supportingDomains = new Set<string>();

  // Build URL-to-domain map from sources
  const urlToDomain = new Map<string, string>();
  for (const s of sources) {
    urlToDomain.set(s.url, s.domain);
  }

  // Check claim against ALL available page texts (cross-source verification)
  for (const [url, pageText] of pageContents) {
    if (!pageText) continue;
    const { score } = verifyTextInSource(claimText, pageText);
    if (score >= 0.3) {
      let domain = urlToDomain.get(url);
      if (!domain) {
        try { domain = new URL(url).hostname; } catch { continue; }
      }
      supportingDomains.add(domain.replace(/^www\./, ""));
    }
  }

  const count = supportingDomains.size;
  let level: "strong" | "moderate" | "weak" | "none";
  if (count >= 3) level = "strong";
  else if (count === 2) level = "moderate";
  else if (count === 1) level = "weak";
  else level = "none";

  return { count, level };
}

// ─── Contradiction Detection (Phase 2) ──────────────────────────────

/**
 * Detect potential contradictions between claims.
 *
 * Uses a two-step approach:
 * 1. Find claim pairs about the same topic (high token overlap)
 * 2. Check for negation asymmetry (one claim negates what the other affirms)
 *
 * This catches patterns like:
 *   "X causes Y" vs "X does not cause Y"
 *   "The study found that..." vs "The study found no evidence that..."
 */
function detectContradictions(claims: string[]): Contradiction[] {
  const contradictions: Contradiction[] = [];

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const overlap = tokenOverlap(claims[i], claims[j]);
      // Same topic threshold — claims must share enough tokens
      if (overlap < 0.3) continue;

      const negA = countNegations(claims[i]);
      const negB = countNegations(claims[j]);

      // Negation asymmetry: one has negation, the other doesn't
      // (or significantly different negation counts)
      if ((negA === 0 && negB > 0) || (negB === 0 && negA > 0)) {
        // Extract shared topic tokens
        const tokensA = new Set(tokenize(claims[i]));
        const tokensB = new Set(tokenize(claims[j]));
        const shared = [...tokensA].filter(t => tokensB.has(t));
        const topic = shared.slice(0, 5).join(" ");

        contradictions.push({
          claimA: claims[i],
          claimB: claims[j],
          topic,
        });
      }
    }
  }

  return contradictions;
}

// ─── Verification Engine ────────────────────────────────────────────

export interface VerifiedSource extends BrowseSource {
  verified: boolean;
  authority: number;
}

export interface VerifiedClaim extends BrowseClaim {
  verified: boolean;
  verificationScore: number;
  consensusCount: number;
  consensusLevel: "strong" | "moderate" | "weak" | "none";
}

export interface VerificationResult {
  claims: VerifiedClaim[];
  sources: VerifiedSource[];
  verificationRate: number;
  avgAuthority: number;
  consensusScore: number;
  contradictions: Contradiction[];
}

/**
 * Full verification pipeline:
 *
 * Phase 1 — BM25 sentence-level matching
 *   Each claim is scored against every sentence in its cited sources.
 *   Source quotes are verified against actual page text.
 *   Domain authority is scored across 150+ known domains in 5 tiers.
 *
 * Phase 2 — Consensus scoring + contradiction detection
 *   Cross-source verification: claims checked against ALL available pages,
 *   not just the ones the LLM cited. Independent domain agreement is counted.
 *   Claim pairs are analyzed for potential contradictions via negation detection.
 *
 * Phase 3 — Enhanced confidence integration
 *   Consensus score feeds into the 7-factor confidence formula.
 *   Contradictions are surfaced to agents for trust decisions.
 */
export function verifyEvidence(
  claims: BrowseClaim[],
  sources: BrowseSource[],
  pageContents: Map<string, string>,
): VerificationResult {
  // Verify sources: check quotes against page text using BM25
  const verifiedSources: VerifiedSource[] = sources.map((source) => {
    const pageText = pageContents.get(source.url) || "";
    const authority = getDomainAuthority(source.domain);

    if (!pageText || !source.quote) {
      return { ...source, verified: false, authority };
    }

    const { score } = verifyTextInSource(source.quote, pageText);
    return {
      ...source,
      verified: score >= 0.35,
      authority,
    };
  });

  // Verify claims with BM25 + consensus scoring
  const verifiedClaims: VerifiedClaim[] = claims.map((claim) => {
    // BM25 verification against cited sources
    let bestScore = 0;
    if (claim.sources && claim.sources.length > 0) {
      for (const url of claim.sources) {
        const pageText = pageContents.get(url) || "";
        if (!pageText) continue;

        const { score } = verifyTextInSource(claim.claim, pageText);
        bestScore = Math.max(bestScore, score);
      }
    }

    // Cross-source consensus (Phase 2)
    const consensus = computeConsensus(claim.claim, pageContents, sources);

    // Boost verification score based on consensus
    // Multi-source agreement increases confidence in the claim
    let adjustedScore = bestScore;
    if (consensus.count >= 3) adjustedScore = Math.min(1, adjustedScore * 1.15);
    else if (consensus.count >= 2) adjustedScore = Math.min(1, adjustedScore * 1.08);

    return {
      ...claim,
      verified: adjustedScore >= 0.3,
      verificationScore: Math.round(adjustedScore * 100) / 100,
      consensusCount: consensus.count,
      consensusLevel: consensus.level,
    };
  });

  // Contradiction detection (Phase 2)
  const claimTexts = claims.map(c => c.claim);
  const contradictions = detectContradictions(claimTexts);

  // Compute aggregate scores
  const verifiedCount = verifiedClaims.filter(c => c.verified).length;
  const verificationRate = claims.length > 0 ? verifiedCount / claims.length : 0;

  const authorities = verifiedSources.map(s => s.authority);
  const avgAuthority = authorities.length > 0
    ? authorities.reduce((a, b) => a + b, 0) / authorities.length
    : 0.5;

  // Consensus score: average consensus level across all claims (0-1)
  const consensusValues: number[] = verifiedClaims.map(c => {
    if (c.consensusLevel === "strong") return 1.0;
    if (c.consensusLevel === "moderate") return 0.7;
    if (c.consensusLevel === "weak") return 0.4;
    return 0;
  });
  const consensusScore = consensusValues.length > 0
    ? consensusValues.reduce((a, b) => a + b, 0) / consensusValues.length
    : 0;

  return {
    claims: verifiedClaims,
    sources: verifiedSources,
    verificationRate: Math.round(verificationRate * 100) / 100,
    avgAuthority: Math.round(avgAuthority * 100) / 100,
    consensusScore: Math.round(consensusScore * 100) / 100,
    contradictions,
  };
}
