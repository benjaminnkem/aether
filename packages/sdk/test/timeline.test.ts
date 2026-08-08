import { describe, expect, it } from "vitest";
import { isRunTimelineEvent } from "../src/index";

describe("run stream frames", () => {
  it("accepts persisted timeline events", () => {
    expect(
      isRunTimelineEvent({
        eventId: "tle_1",
        sequence: 1,
        message: "Verification is retrying.",
        createdAt: "2026-08-08T20:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("rejects terminal boundary frames that are not timeline rows", () => {
    expect(
      isRunTimelineEvent({ runId: "run_1", state: "NEEDS_ATTENTION" }),
    ).toBe(false);
  });
});
