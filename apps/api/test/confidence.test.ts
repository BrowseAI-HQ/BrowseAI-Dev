import { describe, it, expect } from "vitest";
import { computeConfidence } from "../src/lib/gemini.js";
import type { BrowseClaim, BrowseSource } from "@browse/shared";

function makeClaims(n: number, sourcesPerClaim: number = 1): BrowseClaim[] {
  return Array.from({ length: n }, (_, i) => ({
    claim: `Claim ${i}`,
    sources: Array.from({ length: sourcesPerClaim }, (_, j) => `https://source${j}.com`),
  }));
}

function makeSources(n: number): BrowseSource[] {
  return Array.from({ length: n }, (_, i) => ({
    url: `https://source${i}.com`,
    title: `Source ${i}`,
    domain: `source${i}.com`,
    quote: `Quote from source ${i}`,
  }));
}

describe("computeConfidence", () => {
  it("returns 0.10 for no sources", () => {
    expect(computeConfidence([], [], 0, 0, 0, 0)).toBe(0.10);
  });

  it("returns 0.25 for no claims", () => {
    expect(computeConfidence([], makeSources(3), 0, 0, 0, 0)).toBe(0.25);
  });

  it("returns higher confidence with more sources", () => {
    const claims = makeClaims(3, 2);
    const fewSources = makeSources(2);
    const manySources = makeSources(6);

    const confFew = computeConfidence(claims, fewSources, 0.5, 0.5, 0.5, 0);
    const confMany = computeConfidence(claims, manySources, 0.5, 0.5, 0.5, 0);

    expect(confMany).toBeGreaterThan(confFew);
  });

  it("returns higher confidence with better verification", () => {
    const claims = makeClaims(5, 2);
    const sources = makeSources(4);

    const lowVerification = computeConfidence(claims, sources, 0.1, 0.5, 0.3, 0);
    const highVerification = computeConfidence(claims, sources, 0.9, 0.5, 0.3, 0);

    expect(highVerification).toBeGreaterThan(lowVerification);
  });

  it("reduces confidence for contradictions", () => {
    const claims = makeClaims(5, 2);
    const sources = makeSources(4);

    const noContradictions = computeConfidence(claims, sources, 0.8, 0.7, 0.6, 0);
    const withContradictions = computeConfidence(claims, sources, 0.8, 0.7, 0.6, 3);

    expect(withContradictions).toBeLessThan(noContradictions);
  });

  it("clamps confidence to 0.10-0.97 range", () => {
    const claims = makeClaims(10, 3);
    const sources = makeSources(8);

    const maxConf = computeConfidence(claims, sources, 1.0, 1.0, 1.0, 0);
    expect(maxConf).toBeLessThanOrEqual(0.97);
    expect(maxConf).toBeGreaterThanOrEqual(0.10);
  });

  it("boosts factual queries with consensus", () => {
    const claims = makeClaims(3, 2);
    const sources = makeSources(4);

    const genericConf = computeConfidence(claims, sources, 0.4, 0.5, 0.6, 0, "opinion");
    const factualConf = computeConfidence(claims, sources, 0.4, 0.5, 0.6, 0, "factual");

    // Factual queries with consensus get a floor boost
    expect(factualConf).toBeGreaterThanOrEqual(genericConf);
  });

  it("uses different weights for factual vs non-factual", () => {
    const claims = makeClaims(5, 2);
    const sources = makeSources(5);

    // Same inputs, different query types → different scores
    const factual = computeConfidence(claims, sources, 0.3, 0.6, 0.8, 0, "factual");
    const opinion = computeConfidence(claims, sources, 0.3, 0.6, 0.8, 0, "opinion");

    // They should differ because weights are different
    expect(factual).not.toBe(opinion);
  });
});
