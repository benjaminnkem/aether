import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateRuntimeTimeoutEnvironment } from "../src/chains";
import { loadRootEnvironment } from "../src/environment";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("loadRootEnvironment", () => {
  it("finds the workspace .env from a nested package directory", () => {
    const root = createWorkspace();
    const nested = join(root, "apps", "api");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, ".env"), "AETHER_TEST_ROOT_VALUE=loaded\n");
    const environment: NodeJS.ProcessEnv = {};

    expect(
      loadRootEnvironment({ environment, startDirectories: [nested] }),
    ).toBe(join(root, ".env"));
    expect(environment.AETHER_TEST_ROOT_VALUE).toBe("loaded");
  });

  it("preserves values already injected by the process environment", () => {
    const root = createWorkspace();
    writeFileSync(join(root, ".env"), "AETHER_TEST_PRECEDENCE=file\n");
    const environment: NodeJS.ProcessEnv = {
      AETHER_TEST_PRECEDENCE: "injected",
    };

    loadRootEnvironment({ environment, startDirectories: [root] });

    expect(environment.AETHER_TEST_PRECEDENCE).toBe("injected");
  });
});

describe("runtime timeout environment", () => {
  it("accepts bounded provider timeouts", () => {
    expect(() =>
      validateRuntimeTimeoutEnvironment({
        RPC_TIMEOUT_MS: "10000",
        KEEPERHUB_REQUEST_TIMEOUT_MS: "60000",
        GROQ_TIMEOUT_MS: "15000",
      }),
    ).not.toThrow();
  });

  it("rejects timer values that cannot be safely scheduled", () => {
    expect(() =>
      validateRuntimeTimeoutEnvironment({
        RPC_TIMEOUT_MS: "10000000000000000",
      }),
    ).toThrow(
      "RPC_TIMEOUT_MS must be an integer between 1000 and 120000 milliseconds.",
    );
  });
});

function createWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "aether-env-test-"));
  temporaryDirectories.push(root);
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
  return root;
}
