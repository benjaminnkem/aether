import {
  encodeSetOracleCalldata,
  type TransactionRequest,
} from "@aether/backend";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HttpKeeperHubProvider,
  HttpSimulator,
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

describe("live provider adapters", () => {
  beforeEach(() => {
    process.env.KEEPERHUB_BASE_URL = "https://keeperhub.invalid/api";
    process.env.KEEPERHUB_API_KEY = "kh_server_only";
    process.env.AETHER_EXECUTOR_ADDRESS =
      "0x1111111111111111111111111111111111111111";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.KEEPERHUB_BASE_URL;
    delete process.env.KEEPERHUB_API_KEY;
    delete process.env.AETHER_EXECUTOR_ADDRESS;
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
        from: process.env.AETHER_EXECUTOR_ADDRESS,
        to: request.target,
        value: "0",
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

  it("submits one idempotent direct execution and reconciles status", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response([{ chainId: 84_532, isEnabled: true, isTestnet: true }]),
      )
      .mockResolvedValueOnce(
        response({
          executionId: "direct-123",
          status: "completed",
        }),
      )
      .mockResolvedValueOnce(
        response({
          executionId: "direct-123",
          status: "completed",
          transactionHash,
          transactionLink: `https://sepolia.basescan.org/tx/${transactionHash}`,
          gasUsedWei: "1200",
          error: null,
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
      directExecutionId: "direct-123",
      providerCorrelationId: "correlation-123456",
      status: "submitted",
    });
    expect(fetcher.mock.calls[0]?.[0]).toContain("/chains");
    const submitRequest = fetcher.mock.calls[1];
    expect(submitRequest?.[0]).toContain("/execute/contract-call");
    expect(
      new Headers(submitRequest?.[1]?.headers).get("idempotency-key"),
    ).toBe("correlation-123456");

    const status = await provider.reconcile(
      submission.providerCorrelationId,
      submission.directExecutionId,
    );
    expect(status).toMatchObject({
      status: "confirmed",
      transactionHash,
    });
    expect(await provider.getStepLogs(submission.directExecutionId)).toEqual(
      [],
    );
  });
});
