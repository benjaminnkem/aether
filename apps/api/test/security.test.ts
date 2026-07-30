import { describe, expect, it } from "vitest";
import { redact } from "@aether/backend";

describe("security controls", () => {
  it("redacts nested credentials, tokens, and signing material", () => {
    expect(
      redact({
        authorization: "Bearer sensitive",
        nested: {
          keeperHubToken: "sensitive",
          privateKey: "sensitive",
          safe: "visible",
        },
      }),
    ).toEqual({
      authorization: "[REDACTED]",
      nested: {
        keeperHubToken: "[REDACTED]",
        privateKey: "[REDACTED]",
        safe: "visible",
      },
    });
  });
});
