import type { BrowseClaim, BrowseSource } from "@browse/shared";

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
  // Max possible BM25 = sum of all IDFs * (K1+1)/(1+K1*(1-B)) for a perfect match
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
  ".gov", ".edu", ".mil", ".ac.uk", ".gov.uk",
  // Science & health
  "who.int", "cdc.gov", "nih.gov", "nasa.gov", "fda.gov", "epa.gov",
  "nature.com", "science.org", "sciencedirect.com", "springer.com",
  "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "scholar.google.com",
  "thelancet.com", "bmj.com", "nejm.org", "cell.com",
  "ieee.org", "acm.org", "arxiv.org",
  // Standards bodies
  "w3.org", "ietf.org", "iso.org",
];

// Tier 3: Major news & reference (0.85)
const T3 = [
  // News
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk",
  "nytimes.com", "washingtonpost.com", "theguardian.com",
  "economist.com", "ft.com", "wsj.com", "npr.org", "pbs.org",
  "aljazeera.com", "dw.com", "france24.com",
  // Reference
  "wikipedia.org", "britannica.com", "merriam-webster.com",
  // Official docs
  "developer.mozilla.org", "docs.python.org", "docs.microsoft.com",
  "learn.microsoft.com", "cloud.google.com", "developer.apple.com",
  "docs.aws.amazon.com", "docs.oracle.com", "docs.github.com",
  "kubernetes.io", "reactjs.org", "vuejs.org", "angular.io",
  "typescriptlang.org", "rust-lang.org", "go.dev", "python.org",
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
];

// Tier 0: Known low-quality (0.25)
const T0 = [
  "tiktok.com", "pinterest.com",
  // Content farms
  "ehow.com", "answers.com", "ask.com",
];

for (const d of T4) AUTHORITY[d] = 0.95;
for (const d of T3) AUTHORITY[d] = 0.85;
for (const d of T2) AUTHORITY[d] = 0.72;
for (const d of T1) AUTHORITY[d] = 0.60;
for (const d of T0) AUTHORITY[d] = 0.25;

/**
 * Get domain authority score (0–1).
 * Checks exact match, then suffix match (for .gov, .edu, etc.).
 */
export function getDomainAuthority(domain: string): number {
  const d = domain.toLowerCase().replace(/^www\./, "");

  // Exact match
  if (AUTHORITY[d] !== undefined) return AUTHORITY[d];

  // Suffix match (.gov, .edu, .ac.uk, etc.)
  for (const [suffix, score] of Object.entries(AUTHORITY)) {
    if (suffix.startsWith(".") && d.endsWith(suffix)) return score;
  }

  // Unknown domain — neutral
  return 0.5;
}

// ─── Verification Engine ────────────────────────────────────────────

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
  verificationRate: number;
  avgAuthority: number;
}

/**
 * Verify LLM-extracted claims against actual source page content.
 *
 * Uses BM25 sentence-level matching to find the best supporting sentence
 * in each cited source for each claim. This catches paraphrased claims
 * that simple word overlap would miss.
 *
 * Also verifies source quotes against page text and scores domain authority.
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

  // Verify claims: find best matching sentence in cited sources using BM25
  const verifiedClaims: VerifiedClaim[] = claims.map((claim) => {
    if (!claim.sources || claim.sources.length === 0) {
      return { ...claim, verified: false, verificationScore: 0 };
    }

    let bestScore = 0;
    for (const url of claim.sources) {
      const pageText = pageContents.get(url) || "";
      if (!pageText) continue;

      const { score } = verifyTextInSource(claim.claim, pageText);
      bestScore = Math.max(bestScore, score);
    }

    return {
      ...claim,
      verified: bestScore >= 0.3,
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
