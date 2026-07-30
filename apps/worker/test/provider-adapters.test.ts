import {
  encodeSetOracleCalldata,
  type TransactionRequest,
} from "@aether/backend";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HttpKeeperHubProvider,
  HttpSimulator,
  MockGitHubProvider,
  MockInvestigationAssistant,
} from "../src/providers/providers";

const request: TransactionRequest = {
  chainId: 84_532,
  target: "0x7D4A3AfF7c4C51B1726a91c738ACb6F227127C3f",
  functionSignature: "setOracle(address)",
  calldata: encodeSetOracleCalldata(
    "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311",
  ),
  valueWei: "0",
  desiredOracle: "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311",
};
const planHash = `0x${"1".repeat(64)}`;
const transactionHash = `0x${"7".repeat(64)}`;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("live and mock provider adapters", () => {
  beforeEach(() => {
    process.env.KEEPERHUB_BASE_URL = "https://keeperhub.invalid/api";
    process.env.KEEPERHUB_API_TOKEN = "kh_server_only";
    process.env.KEEPERHUB_WORKFLOW_ID = "wf-aether-oracle";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.KEEPERHUB_BASE_URL;
    delete process.env.KEEPERHUB_API_TOKEN;
    delete process.env.KEEPERHUB_WORKFLOW_ID;
  });

  it("simulates the exact semantic request without broadcasting", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        contractAddress: request.target,
        chainId: request.chainId,
        functionName: "setOracle",
        functionArgs: JSON.stringify([request.desiredOracle]),
        value: "0",
        simulate: true,
      });
      expect(typeof body.abi).toBe("string");
      return response({
        success: true,
        status: "simulated",
        gasEstimate: "284211",
        wouldRevert: false,
      });
    });
    vi.stubGlobal("fetch", fetcher);

    const simulation = await new HttpSimulator().simulate(
      planHash,
      request,
      17_924_118,
    );
    expect(simulation).toMatchObject({
      planHash,
      success: true,
      postconditionMatched: true,
      gasEstimate: "284211",
    });
  });

  it("rejects simulation when typed arguments do not match exact calldata", async () => {
    vi.stubGlobal("fetch", vi.fn());

    await expect(
      new HttpSimulator().simulate(
        planHash,
        {
          ...request,
          calldata: encodeSetOracleCalldata(request.target),
        },
        17_924_118,
      ),
    ).rejects.toThrow(/calldata does not match/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits one idempotent workflow and correlates status and step logs", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({ executionId: "exec-123", status: "running" }),
      )
      .mockResolvedValueOnce(
        response({
          status: "success",
          nodeStatuses: [
            {
              nodeId: "write-oracle",
              nodeName: "Set oracle",
              status: "success",
            },
          ],
          transactionHashes: [
            {
              hash: transactionHash,
              nodeId: "write-oracle",
              nodeName: "Set oracle",
              chainId: 84_532,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          logs: [
            {
              id: "log-1",
              nodeId: "write-oracle",
              nodeName: "Set oracle",
              nodeType: "web3/write-contract",
              status: "success",
              output: { transactionHash, authorization: "must-redact" },
              error: null,
              duration: "1200",
              startedAt: "2026-07-30T00:00:00.000Z",
              completedAt: "2026-07-30T00:00:01.200Z",
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const provider = new HttpKeeperHubProvider();

    const submission = await provider.submit(
      "correlation-123456",
      planHash,
      request,
    );
    expect(submission).toMatchObject({
      workflowId: "exec-123",
      providerCorrelationId: "correlation-123456",
      status: "accepted",
    });
    const firstRequest = fetcher.mock.calls[0];
    expect(firstRequest?.[0]).toContain("/workflows/wf-aether-oracle/execute");
    expect(new Headers(firstRequest?.[1]?.headers).get("idempotency-key")).toBe(
      "correlation-123456",
    );

    const status = await provider.reconcile(
      submission.providerCorrelationId,
      submission.workflowId,
    );
    expect(status).toMatchObject({
      status: "confirmed",
      transactionHash,
    });
    const logs = await provider.getStepLogs(submission.workflowId);
    expect(logs[0]).toMatchObject({
      status: "success",
      transactionHash,
    });
    expect(logs[0]?.evidence.authorization).toBe("[REDACTED]");
  });

  it("keeps deterministic GitHub and AI mocks advisory-only", async () => {
    const github = new MockGitHubProvider();
    const assistant = new MockInvestigationAssistant();
    const release = await github.getRelease(
      "arcadia-labs/markets",
      "arcadia-v2.4.2",
    );
    expect(release.commitSha).toHaveLength(40);

    const suggestion = await assistant.suggest({
      findingId: "drift-oracle",
      observedFacts: [`Observed ${"0x3".padEnd(42, "3")}`],
      desiredStateFacts: [`Desired ${request.desiredOracle}`],
      allowedChainIds: [request.chainId],
      allowedTargets: [request.target],
      allowedFunctions: ["setOracle(address)"],
    });
    expect(suggestion).toMatchObject({
      advisoryOnly: true,
      suggestedPlan: {
        chainId: request.chainId,
        target: request.target,
        desiredOracle: request.desiredOracle,
      },
    });
  });
});
