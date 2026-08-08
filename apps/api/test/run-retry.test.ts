import { describe, expect, it } from "vitest";
import {
  retryDelayMs,
  retryableRunError,
} from "../src/runtime/run-coordinator";
import { ProviderRequestError } from "../src/runtime/providers";

describe("run provider retry policy", () => {
  it("retries temporary RPC failures without classifying the write as failed", () => {
    expect(
      retryableRunError(
        new ProviderRequestError(
          "primary RPC returned 503.",
          503,
          7_000,
          false,
          "RPC_TEMPORARY_FAILURE",
        ),
      ),
    ).toEqual({ reason: "primary RPC returned 503.", retryAfterMs: 7_000 });
  });

  it("does not retry permanent RPC configuration failures", () => {
    expect(
      retryableRunError(
        new ProviderRequestError(
          "RPC is on the wrong chain.",
          undefined,
          undefined,
          false,
          "RPC_CHAIN_MISMATCH",
        ),
      ),
    ).toBeUndefined();
  });

  it("uses bounded exponential backoff and honors bounded provider hints", () => {
    expect([1, 2, 3, 4, 5, 10].map((attempt) => retryDelayMs(attempt))).toEqual(
      [5_000, 10_000, 20_000, 40_000, 60_000, 60_000],
    );
    expect(retryDelayMs(1, 120_000)).toBe(60_000);
    expect(retryDelayMs(1, 100)).toBe(1_000);
  });
});
