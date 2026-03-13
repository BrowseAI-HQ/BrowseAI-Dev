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
 *
 * @param bm25Threshold - Adaptive threshold for BM25 match (default 0.35).
 *   Self-learning engine adjusts this per query type based on observed verification rates.
 */
function verifyTextInSource(
  claimText: string,
  sourceText: string,
  bm25Threshold: number = 0.35,
): { score: number; matchedSentence: string | null } {
  // Fast path: exact normalized substring match
  const normalizedClaim = normalize(claimText);
  const normalizedSource = normalize(sourceText);
  if (normalizedClaim.length > 10 && normalizedSource.includes(normalizedClaim)) {
    return { score: 1.0, matchedSentence: claimText };
  }

  // BM25 sentence-level matching
  const { score, sentence } = bm25BestSentence(claimText, sourceText);
  return { score, matchedSentence: score >= bm25Threshold ? sentence : null };
}

// ─── Domain Authority ───────────────────────────────────────────────
// Loaded from Supabase `domain_authority` table on startup.
// Minimal TLD fallback for when DB is unavailable (local dev, noop store).

const AUTHORITY: Record<string, number> = {
  ".gov": 0.95, ".edu": 0.95, ".mil": 0.95,
  ".ac.uk": 0.95, ".gov.uk": 0.95,
};

const LOW_QUALITY_SET = new Set<string>();

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
 * Falls back to minimal TLD defaults if DB is empty or unavailable.
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

// ─── Co-Citation Graph (PageRank alternative) ───────────────────────
// When two domains appear together in query results and both verify well,
// they reinforce each other's trust. Domains that frequently co-occur
// with high-authority domains earn a co-citation boost.

const coCitationScores = new Map<string, number>();

/** Get the co-citation boost for a domain (0–0.15 range). */
export function getCoCitationBoost(domain: string): number {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return coCitationScores.get(d) || 0;
}

/**
 * Compute co-citation scores from stored query results.
 * For each query result, we look at which domains appeared together
 * and which had verified claims. Domains that co-occur with high-authority
 * domains AND both verify well get a mutual boost.
 *
 * This is our alternative to Google's link graph / PageRank.
 */
export function computeCoCitationGraph(
  results: Array<{ sources: Array<{ domain: string; verified?: boolean; authority?: number }> }>
): Map<string, number> {
  // Step 1: Build co-occurrence counts + joint verification rates
  const coOccurrence = new Map<string, Map<string, { count: number; bothVerified: number }>>();

  for (const result of results) {
    if (!result.sources || result.sources.length < 2) continue;

    const domains = [...new Set(result.sources.map(s => s.domain.toLowerCase().replace(/^www\./, "")))];
    const verifiedDomains = new Set(
      result.sources.filter(s => s.verified).map(s => s.domain.toLowerCase().replace(/^www\./, ""))
    );

    // Count pairwise co-occurrences
    for (let i = 0; i < domains.length; i++) {
      for (let j = i + 1; j < domains.length; j++) {
        const a = domains[i], b = domains[j];
        const bothVerified = verifiedDomains.has(a) && verifiedDomains.has(b);

        // a → b
        if (!coOccurrence.has(a)) coOccurrence.set(a, new Map());
        const aMap = coOccurrence.get(a)!;
        const ab = aMap.get(b) || { count: 0, bothVerified: 0 };
        ab.count++;
        if (bothVerified) ab.bothVerified++;
        aMap.set(b, ab);

        // b → a
        if (!coOccurrence.has(b)) coOccurrence.set(b, new Map());
        const bMap = coOccurrence.get(b)!;
        const ba = bMap.get(a) || { count: 0, bothVerified: 0 };
        ba.count++;
        if (bothVerified) ba.bothVerified++;
        bMap.set(a, ba);
      }
    }
  }

  // Step 2: Compute co-citation score per domain
  // Score = weighted average of co-occurring domain authorities × joint verification rate
  const scores = new Map<string, number>();

  for (const [domain, neighbors] of coOccurrence) {
    let totalWeight = 0;
    let weightedScore = 0;

    for (const [neighbor, stats] of neighbors) {
      if (stats.count < 2) continue; // Need at least 2 co-occurrences

      const neighborAuth = getStaticAuthority(neighbor);
      const jointVerifRate = stats.bothVerified / stats.count;
      const weight = stats.count; // More co-occurrences = stronger signal

      weightedScore += neighborAuth * jointVerifRate * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      // Scale to 0–0.15 range (co-citation is a boost, not the main signal)
      const raw = weightedScore / totalWeight;
      scores.set(domain, Math.round(Math.min(0.15, raw * 0.2) * 1000) / 1000);
    }
  }

  return scores;
}

/** Update the co-citation graph cache. Called by admin recalculation. */
export function setCoCitationGraph(scores: Map<string, number>): void {
  coCitationScores.clear();
  for (const [domain, score] of scores) {
    coCitationScores.set(domain, score);
  }
}

// ─── Source Usefulness Tracking (Click Signal Alternative) ───────────
// Tracks which domains consistently produce verified, high-consensus claims.
// Over time, domains with high usefulness are more likely to provide
// good evidence — similar to click-through signals but for agents.

const domainUsefulness = new Map<string, { usefulCount: number; totalCount: number; score: number }>();

/** Get the usefulness score for a domain (0–1). */
export function getDomainUsefulness(domain: string): number {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return domainUsefulness.get(d)?.score || 0;
}

/**
 * Update usefulness tracking for a domain after a query.
 * A source is "useful" if it produced at least one verified claim
 * with moderate+ consensus.
 */
export function trackSourceUsefulness(
  domain: string,
  hadVerifiedClaim: boolean,
  hadConsensus: boolean,
): void {
  const d = domain.toLowerCase().replace(/^www\./, "");
  const existing = domainUsefulness.get(d) || { usefulCount: 0, totalCount: 0, score: 0 };

  existing.totalCount++;
  if (hadVerifiedClaim && hadConsensus) {
    existing.usefulCount++;
  }

  // Usefulness = verified+consensus rate, with minimum 5 samples
  if (existing.totalCount >= 5) {
    existing.score = existing.usefulCount / existing.totalCount;
  }

  domainUsefulness.set(d, existing);
}

/**
 * Compute usefulness scores from stored results (batch, for recalculation).
 */
export function computeUsefulnessScores(
  results: Array<{
    sources: Array<{ domain: string; url: string }>;
    claims: Array<{ sources?: string[]; verified?: boolean; consensusLevel?: string }>;
  }>
): Map<string, { usefulCount: number; totalCount: number; score: number }> {
  const stats = new Map<string, { usefulCount: number; totalCount: number }>();

  for (const result of results) {
    if (!result.sources || !result.claims) continue;

    // Build URL → domain map
    const urlDomain = new Map<string, string>();
    for (const s of result.sources) {
      urlDomain.set(s.url, s.domain.toLowerCase().replace(/^www\./, ""));
    }

    // For each domain, check if it contributed a verified+consensus claim
    const domainUseful = new Map<string, boolean>();
    const domainSeen = new Set<string>();

    for (const s of result.sources) {
      domainSeen.add(s.domain.toLowerCase().replace(/^www\./, ""));
    }

    for (const claim of result.claims) {
      if (!claim.sources) continue;
      const isUseful = claim.verified === true &&
        (claim.consensusLevel === "strong" || claim.consensusLevel === "moderate");

      for (const url of claim.sources) {
        const domain = urlDomain.get(url);
        if (domain && isUseful) {
          domainUseful.set(domain, true);
        }
      }
    }

    // Update stats
    for (const domain of domainSeen) {
      const entry = stats.get(domain) || { usefulCount: 0, totalCount: 0 };
      entry.totalCount++;
      if (domainUseful.get(domain)) entry.usefulCount++;
      stats.set(domain, entry);
    }
  }

  // Compute scores
  const scored = new Map<string, { usefulCount: number; totalCount: number; score: number }>();
  for (const [domain, s] of stats) {
    if (s.totalCount >= 3) { // Minimum sample threshold
      scored.set(domain, { ...s, score: s.usefulCount / s.totalCount });
    }
  }
  return scored;
}

/** Bulk-set usefulness scores (from recalculation). */
export function setUsefulnessScores(
  scores: Map<string, { usefulCount: number; totalCount: number; score: number }>
): void {
  domainUsefulness.clear();
  for (const [domain, data] of scores) {
    domainUsefulness.set(domain, data);
  }
}

// ─── Source Reranking (Perplexity-style) ─────────────────────────────
// After search results come back, rerank them using our domain intelligence
// before fetching pages. Better sources get fetched first = better answers.

export interface RerankableResult {
  url: string;
  title: string;
  score: number; // Original search score
  [key: string]: unknown;
}

/**
 * Rerank search results using BrowseAI's domain intelligence.
 *
 * Combines:
 * - Original search score (from Tavily/Brave) — 40%
 * - Domain authority (static + dynamic Bayesian) — 30%
 * - Source usefulness (verified+consensus track record) — 20%
 * - Co-citation boost (frequently co-occurs with trusted domains) — 10%
 *
 * This is our alternative to Perplexity's LLM reranking — zero extra
 * API calls, uses our accumulated intelligence instead.
 */
export function rerankSources<T extends RerankableResult>(results: T[]): T[] {
  if (results.length <= 1) return results;

  // Normalize search scores to 0-1
  const maxScore = Math.max(...results.map(r => r.score));
  const minScore = Math.min(...results.map(r => r.score));
  const scoreRange = maxScore - minScore || 1;

  const scored = results.map(r => {
    let domain: string;
    try {
      domain = new URL(r.url).hostname.replace(/^www\./, "");
    } catch {
      return { result: r, combinedScore: r.score };
    }

    const normalizedSearch = (r.score - minScore) / scoreRange;
    const authority = getDomainAuthority(domain);
    const usefulness = getDomainUsefulness(domain);
    const coCitation = getCoCitationBoost(domain);

    const combinedScore =
      normalizedSearch * 0.40 +
      authority * 0.30 +
      usefulness * 0.20 +
      coCitation * (1 / 0.15) * 0.10; // Normalize co-citation from 0-0.15 to 0-1, then weight

    return { result: r, combinedScore };
  });

  scored.sort((a, b) => b.combinedScore - a.combinedScore);
  return scored.map(s => s.result);
}

// ─── Dynamic Authority (Bayesian smoothing) ─────────────────────────

const dynamicAuthority = new Map<string, { dynamicScore: number; sampleCount: number }>();

/**
 * Bayesian prior weight — controls cold start behavior.
 * With PRIOR_WEIGHT=15, a domain needs ~15 samples before dynamic
 * data carries equal weight to the static tier score.
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

/**
 * Incrementally update a single domain's dynamic authority based on new verification data.
 * Called inline after each query — lightweight, no DB read needed.
 *
 * Uses incremental mean: newAvg = oldAvg + (newValue - oldAvg) / newCount
 */
export function updateDomainScore(domain: string, verified: boolean): void {
  const d = domain.toLowerCase().replace(/^www\./, "");
  const existing = dynamicAuthority.get(d);
  const value = verified ? 1.0 : 0.0;

  if (existing) {
    const newCount = existing.sampleCount + 1;
    const newScore = existing.dynamicScore + (value - existing.dynamicScore) / newCount;
    dynamicAuthority.set(d, { dynamicScore: newScore, sampleCount: newCount });
  } else {
    dynamicAuthority.set(d, { dynamicScore: value, sampleCount: 1 });
  }
}

/** Get current accumulated dynamic stats for a domain (for DB persistence). */
export function getDynamicStats(domain: string): { dynamicScore: number; sampleCount: number } | null {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return dynamicAuthority.get(d) || null;
}

/** Get the static authority score for a domain. */
function getStaticAuthority(domain: string): number {
  const d = domain.toLowerCase().replace(/^www\./, "");

  if (AUTHORITY[d] !== undefined) return AUTHORITY[d];

  for (const [suffix, score] of Object.entries(AUTHORITY)) {
    if (suffix.startsWith(".") && d.endsWith(suffix)) return score;
  }

  return 0.5;
}

/**
 * Get domain authority score (0–1) with Bayesian cold-start smoothing
 * and co-citation boost.
 *
 * Formula: blended = (static * PRIOR_WEIGHT + dynamic * sampleCount) / (PRIOR_WEIGHT + sampleCount) + coCitation
 */
export function getDomainAuthority(domain: string): number {
  const d = domain.toLowerCase().replace(/^www\./, "");
  const staticScore = getStaticAuthority(d);

  let base: number;
  const dynamic = dynamicAuthority.get(d);
  if (!dynamic || dynamic.sampleCount < 3) {
    base = staticScore;
  } else {
    base = (staticScore * PRIOR_WEIGHT + dynamic.dynamicScore * dynamic.sampleCount)
      / (PRIOR_WEIGHT + dynamic.sampleCount);
  }

  // Add co-citation boost (0–0.15): domains that co-occur with trusted, verified domains
  const coCitation = getCoCitationBoost(d);

  return Math.round(Math.min(1, base + coCitation) * 100) / 100;
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
  consensusThreshold: number = 0.2,
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
    if (score >= consensusThreshold) {
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
 *   Domain authority is scored across 10,000+ domains in 5 tiers.
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
  options?: { bm25Threshold?: number; consensusThreshold?: number },
): VerificationResult {
  const bm25Threshold = options?.bm25Threshold ?? 0.35;
  const consensusThreshold = options?.consensusThreshold ?? 0.20;
  // Verify sources: check quotes against page text using BM25
  const verifiedSources: VerifiedSource[] = sources.map((source) => {
    const pageText = pageContents.get(source.url) || "";
    const authority = getDomainAuthority(source.domain);

    if (!pageText || !source.quote) {
      return { ...source, verified: false, authority };
    }

    const { score } = verifyTextInSource(source.quote, pageText, bm25Threshold);
    return {
      ...source,
      verified: score >= bm25Threshold,
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

        const { score } = verifyTextInSource(claim.claim, pageText, bm25Threshold);
        bestScore = Math.max(bestScore, score);
      }
    }

    // Cross-source consensus (Phase 2)
    const consensus = computeConsensus(claim.claim, pageContents, sources, consensusThreshold);

    // Boost verification score based on consensus
    // Multi-source agreement increases confidence in the claim
    let adjustedScore = bestScore;
    if (consensus.count >= 3) adjustedScore = Math.min(1, adjustedScore * 1.15);
    else if (consensus.count >= 2) adjustedScore = Math.min(1, adjustedScore * 1.08);

    return {
      ...claim,
      verified: adjustedScore >= 0.2,
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
