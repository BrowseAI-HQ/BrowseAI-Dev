/**
 * Self-Learning Engine for BrowseAI Dev
 *
 * Tracks query performance signals and adaptively tunes thresholds:
 * - BM25 verification threshold (per query type)
 * - Consensus scoring threshold
 * - Confidence weights (per query type)
 * - Page count optimization
 *
 * All learning is in-memory with periodic DB persistence.
 * Fire-and-forget — never blocks the response path.
 */

import type { QueryType } from "./gemini.js";

// ─── Types ───────────────────────────────────────────────────────────

export interface QuerySignals {
  queryType: QueryType;
  confidence: number;
  verificationRate: number;
  consensusScore: number;
  sourceCount: number;
  claimCount: number;
  contradictionCount: number;
  responseTimeMs: number;
  depth: "fast" | "thorough";
  /** True if thorough mode retry improved confidence */
  thoroughImproved?: boolean;
}

export interface FeedbackSignal {
  resultId: string;
  rating: "good" | "bad" | "wrong";
  /** Optional: which claim was wrong */
  claimIndex?: number;
}

interface QueryTypeStats {
  count: number;
  avgConfidence: number;
  avgVerificationRate: number;
  avgConsensusScore: number;
  avgSourceCount: number;
  avgResponseTimeMs: number;
  thoroughCount: number;
  thoroughImprovedCount: number;
  /** Feedback: positive vs negative */
  positiveCount: number;
  negativeCount: number;
}

interface AdaptiveThresholds {
  /** BM25 score threshold for claim verification (default: 0.35) */
  bm25Threshold: number;
  /** BM25 score threshold for consensus matching (default: 0.20) */
  consensusThreshold: number;
  /** Optimal page count for this query type */
  pageCount: number;
  /** Confidence weight adjustments */
  weights: {
    source: number;
    domain: number;
    grounding: number;
    depth: number;
    verification: number;
    authority: number;
    consensus: number;
  };
}

// ─── Defaults ────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  source: 0.15, domain: 0.10, grounding: 0.10, depth: 0.05,
  verification: 0.25, authority: 0.20, consensus: 0.15,
};

const FACTUAL_WEIGHTS = {
  source: 0.20, domain: 0.10, grounding: 0.10, depth: 0.05,
  verification: 0.10, authority: 0.20, consensus: 0.25,
};

const DEFAULT_PAGE_COUNTS: Record<string, number> = {
  factual: 6, comparison: 10, "how-to": 6, "time-sensitive": 8, opinion: 10,
};

const DEFAULT_THRESHOLDS: AdaptiveThresholds = {
  bm25Threshold: 0.35,
  consensusThreshold: 0.20,
  pageCount: 6,
  weights: { ...DEFAULT_WEIGHTS },
};

// ─── State ───────────────────────────────────────────────────────────

/** Per-query-type performance stats (in-memory, accumulated) */
const queryTypeStats = new Map<string, QueryTypeStats>();

/** Per-query-type adaptive thresholds (computed from stats) */
const adaptiveThresholds = new Map<string, AdaptiveThresholds>();

/** Recent feedback signals (ring buffer, last 200) */
const feedbackBuffer: Array<FeedbackSignal & { timestamp: number }> = [];
const MAX_FEEDBACK = 200;

/** Minimum samples before adaptive thresholds kick in */
const MIN_SAMPLES = 20;

/** Learning rate — how fast new data shifts thresholds (0-1) */
const LEARNING_RATE = 0.1;

// ─── Recording Signals ──────────────────────────────────────────────

/**
 * Record performance signals from a completed query.
 * Called inline after each answer — lightweight, no DB.
 */
export function recordQuerySignals(signals: QuerySignals): void {
  const type = signals.queryType || "general";
  const stats = queryTypeStats.get(type) || {
    count: 0,
    avgConfidence: 0,
    avgVerificationRate: 0,
    avgConsensusScore: 0,
    avgSourceCount: 0,
    avgResponseTimeMs: 0,
    thoroughCount: 0,
    thoroughImprovedCount: 0,
    positiveCount: 0,
    negativeCount: 0,
  };

  // Incremental mean update: newAvg = oldAvg + (value - oldAvg) / newCount
  stats.count++;
  const n = stats.count;
  stats.avgConfidence += (signals.confidence - stats.avgConfidence) / n;
  stats.avgVerificationRate += (signals.verificationRate - stats.avgVerificationRate) / n;
  stats.avgConsensusScore += (signals.consensusScore - stats.avgConsensusScore) / n;
  stats.avgSourceCount += (signals.sourceCount - stats.avgSourceCount) / n;
  stats.avgResponseTimeMs += (signals.responseTimeMs - stats.avgResponseTimeMs) / n;

  if (signals.depth === "thorough") {
    stats.thoroughCount++;
    if (signals.thoroughImproved) stats.thoroughImprovedCount++;
  }

  queryTypeStats.set(type, stats);

  // Recompute adaptive thresholds if enough data
  if (stats.count >= MIN_SAMPLES) {
    recomputeThresholds(type, stats);
  }
}

/**
 * Record explicit user feedback on a result.
 */
export function recordFeedback(feedback: FeedbackSignal): void {
  // Add to ring buffer
  if (feedbackBuffer.length >= MAX_FEEDBACK) {
    feedbackBuffer.shift();
  }
  feedbackBuffer.push({ ...feedback, timestamp: Date.now() });
}

/**
 * Apply feedback to query type stats.
 * Called when we can link feedback to a query type.
 */
export function applyFeedbackToType(queryType: string, rating: "good" | "bad" | "wrong"): void {
  const stats = queryTypeStats.get(queryType);
  if (!stats) return;

  if (rating === "good") {
    stats.positiveCount++;
  } else {
    stats.negativeCount++;
  }

  // Re-tune if enough feedback
  if (stats.count >= MIN_SAMPLES) {
    recomputeThresholds(queryType, stats);
  }
}

// ─── Threshold Computation ──────────────────────────────────────────

/**
 * Recompute adaptive thresholds for a query type based on accumulated stats.
 *
 * Strategy:
 * - If verification rate is low → lower BM25 threshold (too strict)
 * - If verification rate is high + confidence high → thresholds are good
 * - If negative feedback is high → raise thresholds (being too lenient)
 * - Page count adjusts based on avg source count vs confidence correlation
 */
function recomputeThresholds(queryType: string, stats: QueryTypeStats): void {
  const current = adaptiveThresholds.get(queryType) || { ...DEFAULT_THRESHOLDS };

  // ─── BM25 Threshold Adaptation ───
  // Target: ~70% verification rate. Below → lower threshold, above → raise it.
  const targetVerification = 0.70;
  const verificationDelta = stats.avgVerificationRate - targetVerification;

  // Shift threshold: if verification too low, lower threshold to be more lenient
  // If verification too high, raise threshold to be stricter
  const bm25Shift = verificationDelta * LEARNING_RATE;
  current.bm25Threshold = clamp(
    current.bm25Threshold + bm25Shift,
    0.15, // Never go below 0.15 (too permissive)
    0.55, // Never go above 0.55 (too strict)
  );

  // ─── Consensus Threshold Adaptation ───
  // Similar logic: if consensus is very high, raise threshold
  const targetConsensus = 0.50;
  const consensusDelta = stats.avgConsensusScore - targetConsensus;
  const consensusShift = consensusDelta * LEARNING_RATE * 0.5; // Slower adaptation
  current.consensusThreshold = clamp(
    current.consensusThreshold + consensusShift,
    0.10,
    0.40,
  );

  // ─── Page Count Adaptation ───
  // If avg confidence is low and we're not getting enough sources, increase pages
  const basePage = DEFAULT_PAGE_COUNTS[queryType] || 6;
  if (stats.avgConfidence < 0.60 && stats.avgSourceCount < basePage * 0.8) {
    current.pageCount = Math.min(basePage + 4, 15);
  } else if (stats.avgConfidence > 0.80 && stats.avgSourceCount > basePage * 1.2) {
    current.pageCount = Math.max(basePage - 1, 4);
  } else {
    current.pageCount = basePage;
  }

  // ─── Weight Adaptation (feedback-driven) ───
  const totalFeedback = stats.positiveCount + stats.negativeCount;
  if (totalFeedback >= 5) {
    const negativeRate = stats.negativeCount / totalFeedback;

    if (negativeRate > 0.3) {
      // Too many negative ratings → increase verification & authority weights
      const isFactual = queryType === "factual";
      const base = isFactual ? { ...FACTUAL_WEIGHTS } : { ...DEFAULT_WEIGHTS };

      current.weights = {
        ...base,
        verification: clamp(base.verification + 0.05, 0.05, 0.35),
        authority: clamp(base.authority + 0.03, 0.10, 0.30),
        consensus: clamp(base.consensus + 0.02, 0.05, 0.30),
        // Reduce source count weight to compensate
        source: clamp(base.source - 0.05, 0.05, 0.25),
        grounding: clamp(base.grounding - 0.03, 0.05, 0.15),
        depth: clamp(base.depth - 0.02, 0.02, 0.10),
      };
    }
  }

  adaptiveThresholds.set(queryType, current);
}

// ─── Getters (used by verify.ts and gemini.ts) ──────────────────────

/**
 * Get the adaptive BM25 threshold for a query type.
 * Returns default (0.35) if not enough data yet.
 */
export function getAdaptiveBM25Threshold(queryType?: string): number {
  if (!queryType) return 0.35;
  return adaptiveThresholds.get(queryType)?.bm25Threshold ?? 0.35;
}

/**
 * Get the adaptive consensus threshold for a query type.
 * Returns default (0.20) if not enough data yet.
 */
export function getAdaptiveConsensusThreshold(queryType?: string): number {
  if (!queryType) return 0.20;
  return adaptiveThresholds.get(queryType)?.consensusThreshold ?? 0.20;
}

/**
 * Get adaptive page count for a query type.
 */
export function getAdaptivePageCount(queryType?: string): number {
  if (!queryType) return 6;
  return adaptiveThresholds.get(queryType)?.pageCount
    ?? DEFAULT_PAGE_COUNTS[queryType]
    ?? 6;
}

/**
 * Get adaptive confidence weights for a query type.
 */
export function getAdaptiveWeights(queryType?: string): AdaptiveThresholds["weights"] {
  if (!queryType) return { ...DEFAULT_WEIGHTS };

  const adaptive = adaptiveThresholds.get(queryType);
  if (adaptive) return { ...adaptive.weights };

  return queryType === "factual" ? { ...FACTUAL_WEIGHTS } : { ...DEFAULT_WEIGHTS };
}

// ─── Diagnostics ─────────────────────────────────────────────────────

/**
 * Get learning stats for admin dashboard / diagnostics.
 */
export function getLearningStats(): {
  queryTypes: Record<string, QueryTypeStats & { thresholds?: AdaptiveThresholds }>;
  feedbackCount: number;
  totalQueries: number;
} {
  const queryTypes: Record<string, QueryTypeStats & { thresholds?: AdaptiveThresholds }> = {};
  let totalQueries = 0;

  for (const [type, stats] of queryTypeStats) {
    totalQueries += stats.count;
    queryTypes[type] = {
      ...stats,
      thresholds: adaptiveThresholds.get(type),
    };
  }

  return { queryTypes, feedbackCount: feedbackBuffer.length, totalQueries };
}

/**
 * Export current adaptive state for DB persistence.
 */
export function exportLearningState(): {
  queryTypeStats: Array<{ queryType: string; stats: QueryTypeStats }>;
  thresholds: Array<{ queryType: string; thresholds: AdaptiveThresholds }>;
} {
  return {
    queryTypeStats: [...queryTypeStats.entries()].map(([queryType, stats]) => ({ queryType, stats })),
    thresholds: [...adaptiveThresholds.entries()].map(([queryType, thresholds]) => ({ queryType, thresholds })),
  };
}

/**
 * Import learning state from DB (called on startup).
 */
export function importLearningState(state: {
  queryTypeStats?: Array<{ queryType: string; stats: QueryTypeStats }>;
  thresholds?: Array<{ queryType: string; thresholds: AdaptiveThresholds }>;
}): void {
  if (state.queryTypeStats) {
    for (const { queryType, stats } of state.queryTypeStats) {
      queryTypeStats.set(queryType, stats);
    }
  }
  if (state.thresholds) {
    for (const { queryType, thresholds } of state.thresholds) {
      adaptiveThresholds.set(queryType, thresholds);
    }
  }
}

// ─── Utilities ───────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
