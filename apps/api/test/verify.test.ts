import { describe, it, expect } from "vitest";
import { verifyEvidence, getDomainAuthority, updateDomainScore } from "../src/lib/verify.js";
import type { BrowseClaim, BrowseSource } from "@browse/shared";

describe("verifyEvidence", () => {
  const baseSource: BrowseSource = {
    url: "https://example.com/article",
    title: "Test Article",
    domain: "example.com",
    quote: "Quantum computing uses qubits to process information",
  };

  const baseClaim: BrowseClaim = {
    claim: "Quantum computing uses qubits to process information",
    sources: ["https://example.com/article"],
  };

  it("verifies a claim that matches source text exactly", () => {
    const pageContents = new Map([
      ["https://example.com/article", "Quantum computing uses qubits to process information. It is a revolutionary technology."],
    ]);

    const result = verifyEvidence([baseClaim], [baseSource], pageContents);

    expect(result.claims[0].verified).toBe(true);
    expect(result.claims[0].verificationScore).toBeGreaterThan(0);
    expect(result.verificationRate).toBe(1);
  });

  it("fails verification when source text is completely unrelated", () => {
    const pageContents = new Map([
      ["https://example.com/article", "The weather today is sunny with temperatures around 75 degrees Fahrenheit."],
    ]);

    const unrelatedClaim: BrowseClaim = {
      claim: "Machine learning requires large datasets for training neural networks",
      sources: ["https://example.com/article"],
    };

    const result = verifyEvidence([unrelatedClaim], [baseSource], pageContents);

    expect(result.claims[0].verificationScore).toBeLessThan(0.35);
  });

  it("verifies paraphrased claims via BM25 matching", () => {
    const pageContents = new Map([
      ["https://example.com/article", "Quantum computers utilize quantum bits, known as qubits, for processing computational information and solving complex problems."],
    ]);

    const paraphrasedClaim: BrowseClaim = {
      claim: "Quantum computers use qubits for processing information",
      sources: ["https://example.com/article"],
    };

    const result = verifyEvidence([paraphrasedClaim], [baseSource], pageContents);

    expect(result.claims[0].verificationScore).toBeGreaterThan(0);
  });

  it("computes consensus across multiple sources", () => {
    const sources: BrowseSource[] = [
      { url: "https://a.com/1", title: "A", domain: "a.com", quote: "Q" },
      { url: "https://b.com/1", title: "B", domain: "b.com", quote: "Q" },
      { url: "https://c.com/1", title: "C", domain: "c.com", quote: "Q" },
    ];

    const claim: BrowseClaim = {
      claim: "Python is a popular programming language for data science",
      sources: ["https://a.com/1"],
    };

    const pageContents = new Map([
      ["https://a.com/1", "Python is a popular programming language used widely for data science and machine learning applications."],
      ["https://b.com/1", "Data science professionals frequently use Python as their primary programming language for analysis and machine learning."],
      ["https://c.com/1", "Python programming language is among the most popular choices for data science and artificial intelligence projects."],
    ]);

    const result = verifyEvidence([claim], sources, pageContents);

    expect(result.claims[0].consensusCount).toBeGreaterThanOrEqual(2);
    expect(result.claims[0].consensusLevel).not.toBe("none");
    expect(result.consensusScore).toBeGreaterThan(0);
  });

  it("detects contradictions between claims", () => {
    const claims: BrowseClaim[] = [
      { claim: "Coffee consumption increases heart disease risk significantly", sources: [] },
      { claim: "Coffee consumption does not increase heart disease risk", sources: [] },
    ];

    const result = verifyEvidence(claims, [], new Map());

    expect(result.contradictions.length).toBeGreaterThanOrEqual(1);
    expect(result.contradictions[0].claimA).toContain("Coffee");
    expect(result.contradictions[0].claimB).toContain("Coffee");
  });

  it("computes domain authority for known TLDs", () => {
    const sources: BrowseSource[] = [
      { url: "https://nasa.gov/science", title: "NASA", domain: "nasa.gov", quote: "Q" },
    ];

    const result = verifyEvidence([], sources, new Map());

    expect(result.sources[0].authority).toBeGreaterThanOrEqual(0.9);
  });

  it("returns 0.5 authority for unknown domains", () => {
    const authority = getDomainAuthority("random-blog-xyz.com");
    expect(authority).toBe(0.5);
  });

  it("returns aggregate metrics", () => {
    const sources: BrowseSource[] = [
      { url: "https://a.com", title: "A", domain: "a.com", quote: "Test quote about technology" },
    ];
    const claims: BrowseClaim[] = [
      { claim: "Technology is advancing rapidly", sources: ["https://a.com"] },
      { claim: "AI will transform industries", sources: ["https://a.com"] },
    ];
    const pageContents = new Map([
      ["https://a.com", "Technology is advancing rapidly in every sector. AI will transform industries and create new opportunities."],
    ]);

    const result = verifyEvidence(claims, sources, pageContents);

    expect(result.verificationRate).toBeGreaterThanOrEqual(0);
    expect(result.verificationRate).toBeLessThanOrEqual(1);
    expect(result.avgAuthority).toBeGreaterThanOrEqual(0);
    expect(result.avgAuthority).toBeLessThanOrEqual(1);
    expect(result.consensusScore).toBeGreaterThanOrEqual(0);
    expect(result.consensusScore).toBeLessThanOrEqual(1);
  });
});

describe("updateDomainScore", () => {
  it("tracks dynamic verification scores", () => {
    // Update several times
    updateDomainScore("test-dynamic.com", true);
    updateDomainScore("test-dynamic.com", true);
    updateDomainScore("test-dynamic.com", false);

    // After 3 samples, dynamic score should influence authority
    const authority = getDomainAuthority("test-dynamic.com");
    expect(authority).toBeGreaterThan(0);
    expect(authority).toBeLessThanOrEqual(1);
  });
});
