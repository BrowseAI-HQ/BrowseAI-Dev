import type { BrowseClaim, BrowseSource } from "@browse/shared";

/**
 * Normalized comparison: lowercase, collapse whitespace, strip punctuation.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if a short text (needle) appears in a longer text (haystack)
 * using word-level overlap. Returns a similarity score 0–1.
 *
 * Uses Jaccard-like word overlap: |intersection| / |needle words|
 * This is more robust than substring matching for LLM-paraphrased quotes.
 */
function wordOverlap(needle: string, haystack: string): number {
  const needleWords = new Set(normalize(needle).split(" ").filter(w => w.length > 2));
  if (needleWords.size === 0) return 0;

  const haystackWords = new Set(normalize(haystack).split(" ").filter(w => w.length > 2));
  let matched = 0;
  for (const word of needleWords) {
    if (haystackWords.has(word)) matched++;
  }
  return matched / needleWords.size;
}

/**
 * Find the best matching substring in source text for a quote.
 * Returns the actual text from the source if match is good enough.
 */
function findBestMatch(quote: string, sourceText: string): { score: number; extractedQuote: string | null } {
  const normalizedQuote = normalize(quote);
  const words = normalizedQuote.split(" ").filter(w => w.length > 2);
  if (words.length === 0) return { score: 0, extractedQuote: null };

  // Try exact substring first (normalized)
  const normalizedSource = normalize(sourceText);
  if (normalizedSource.includes(normalizedQuote)) {
    return { score: 1.0, extractedQuote: quote };
  }

  // Fall back to word overlap
  const score = wordOverlap(quote, sourceText);
  return { score, extractedQuote: score >= 0.6 ? quote : null };
}

// Domain authority tiers (higher = more trusted)
const AUTHORITY_TIERS: Record<string, number> = {};

// Tier 3: Highly authoritative (0.95)
const TIER_3 = [
  ".gov", ".edu", "who.int", "cdc.gov", "nih.gov", "nasa.gov",
  "nature.com", "science.org", "pubmed.ncbi.nlm.nih.gov",
];

// Tier 2: Major established sources (0.8)
const TIER_2 = [
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk",
  "nytimes.com", "washingtonpost.com", "theguardian.com",
  "wikipedia.org", "britannica.com",
  "techcrunch.com", "arstechnica.com", "wired.com",
  "stackoverflow.com", "developer.mozilla.org",
  "docs.python.org", "docs.microsoft.com", "cloud.google.com",
];

// Tier 1: Known decent sources (0.65)
const TIER_1 = [
  "medium.com", "dev.to", "hackernews.com",
  "forbes.com", "bloomberg.com", "cnbc.com",
  "github.com", "npmjs.com", "pypi.org",
];

for (const d of TIER_3) AUTHORITY_TIERS[d] = 0.95;
for (const d of TIER_2) AUTHORITY_TIERS[d] = 0.8;
for (const d of TIER_1) AUTHORITY_TIERS[d] = 0.65;

/**
 * Get domain authority score (0–1).
 * Checks exact match and suffix match (for .gov, .edu).
 */
export function getDomainAuthority(domain: string): number {
  const d = domain.toLowerCase();

  // Exact match
  if (AUTHORITY_TIERS[d] !== undefined) return AUTHORITY_TIERS[d];

  // Suffix match (.gov, .edu, etc.)
  for (const [suffix, score] of Object.entries(AUTHORITY_TIERS)) {
    if (suffix.startsWith(".") && d.endsWith(suffix)) return score;
  }

  // Unknown domain — neutral
  return 0.5;
}

export interface VerifiedSource extends BrowseSource {
  verified: boolean;
  authority: number;
}

export interface VerifiedClaim extends BrowseClaim {
  verified: boolean;
  verificationScore: number;
}

export interface VerificationResult {
  claims: VerifiedClaim[];
  sources: VerifiedSource[];
  verificationRate: number;   // 0–1: fraction of claims verified in sources
  avgAuthority: number;       // 0–1: average domain authority
}

/**
 * Verify LLM-extracted claims against actual source page content.
 *
 * For each claim: check if the claim text or associated quote
 * has word-level overlap with the cited source pages.
 *
 * For each source: verify the quote appears in its page content.
 */
export function verifyEvidence(
  claims: BrowseClaim[],
  sources: BrowseSource[],
  pageContents: Map<string, string>,
): VerificationResult {
  // Verify sources: check quotes against page text
  const verifiedSources: VerifiedSource[] = sources.map((source) => {
    const pageText = pageContents.get(source.url) || "";
    const authority = getDomainAuthority(source.domain);

    if (!pageText || !source.quote) {
      return { ...source, verified: false, authority };
    }

    const { score } = findBestMatch(source.quote, pageText);
    return {
      ...source,
      verified: score >= 0.5,
      authority,
    };
  });

  // Build lookup: URL → verified?
  const sourceVerified = new Map<string, boolean>();
  for (const s of verifiedSources) {
    sourceVerified.set(s.url, s.verified);
  }

  // Verify claims: check if claim text has overlap with cited source pages
  const verifiedClaims: VerifiedClaim[] = claims.map((claim) => {
    if (!claim.sources || claim.sources.length === 0) {
      return { ...claim, verified: false, verificationScore: 0 };
    }

    // For each cited source, check if the claim text appears in that page
    let bestScore = 0;
    for (const url of claim.sources) {
      const pageText = pageContents.get(url) || "";
      if (!pageText) continue;

      const { score } = findBestMatch(claim.claim, pageText);
      bestScore = Math.max(bestScore, score);
    }

    return {
      ...claim,
      verified: bestScore >= 0.4,
      verificationScore: Math.round(bestScore * 100) / 100,
    };
  });

  const verifiedCount = verifiedClaims.filter(c => c.verified).length;
  const verificationRate = claims.length > 0 ? verifiedCount / claims.length : 0;

  const authorities = verifiedSources.map(s => s.authority);
  const avgAuthority = authorities.length > 0
    ? authorities.reduce((a, b) => a + b, 0) / authorities.length
    : 0.5;

  return {
    claims: verifiedClaims,
    sources: verifiedSources,
    verificationRate: Math.round(verificationRate * 100) / 100,
    avgAuthority: Math.round(avgAuthority * 100) / 100,
  };
}
