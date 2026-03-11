import { describe, it, expect, vi } from "vitest";
import { withRetry, fetchWithRetry, isRetryableStatus } from "../src/lib/retry.js";

describe("isRetryableStatus", () => {
  it("retries 429 rate limit", () => {
    expect(isRetryableStatus(429)).toBe(true);
  });

  it("retries 500-599 server errors", () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it("does not retry client errors", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });

  it("does not retry 200 OK", () => {
    expect(isRetryableStatus(200)).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient failure then succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 10,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    await expect(
      withRetry(fn, { maxRetries: 2, initialDelayMs: 10 })
    ).rejects.toThrow("fetch failed");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("does not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Invalid API key"));

    await expect(
      withRetry(fn, { maxRetries: 3, initialDelayMs: 10 })
    ).rejects.toThrow("Invalid API key");
    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  it("retries on rate limit errors", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("Rate limit exceeded"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, {
      maxRetries: 2,
      initialDelayMs: 10,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("supports custom isRetryable", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("custom transient"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, {
      maxRetries: 2,
      initialDelayMs: 10,
      isRetryable: (e) => (e as Error).message.includes("custom transient"),
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
