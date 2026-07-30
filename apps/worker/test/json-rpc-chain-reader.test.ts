import {
  encodeSetOracleCalldata,
  type TransactionRequest,
} from "@aether/backend";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JsonRpcChainReader,
  ReorgDetectedError,
  UnknownReceiptOutcomeError,
} from "../src/providers/providers";

const chainId = 84_532;
const market = "0x7D4A3AfF7c4C51B1726a91c738ACb6F227127C3f";
const approvedOracle = "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311";
const transactionHash = `0x${"7".repeat(64)}`;
const receiptBlockHash = `0x${"1".repeat(64)}`;
const headBlockHash = `0x${"2".repeat(64)}`;

const request: TransactionRequest = {
  chainId,
  target: market,
  functionSignature: "setOracle(address)",
  calldata: encodeSetOracleCalldata(approvedOracle),
  valueWei: "0",
  desiredOracle: approvedOracle,
};

function response(result: unknown) {
  return {
    ok: true,
    json: async () => ({ jsonrpc: "2.0", id: 1, result }),
  } as Response;
}

function oracleStatusResult(oracle: string, updatedAt: number, fresh: boolean) {
  const addressWord = oracle.slice(2).toLowerCase().padStart(64, "0");
  const timestampWord = updatedAt.toString(16).padStart(64, "0");
  const freshWord = (fresh ? "1" : "0").padStart(64, "0");
  return `0x${addressWord}${timestampWord}${freshWord}`;
}

describe("JsonRpcChainReader finality and reorg safety", () => {
  beforeEach(() => {
    process.env.AETHER_RPC_URL = "http://rpc.invalid";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AETHER_RPC_URL;
  });

  it("keeps an unavailable receipt in the unknown-outcome path", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("0x14a34"))
      .mockResolvedValueOnce(response(null));
    vi.stubGlobal("fetch", fetchMock);
    const reader = new JsonRpcChainReader();
    await expect(
      reader.verifyOracle(request, 12, transactionHash),
    ).rejects.toBeInstanceOf(UnknownReceiptOutcomeError);
  });

  it("waits for the configured confirmation threshold", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("0x14a34"))
      .mockResolvedValueOnce(
        response({
          transactionHash,
          blockHash: receiptBlockHash,
          blockNumber: "0x64",
          status: "0x1",
        }),
      )
      .mockResolvedValue(response("0x68"));
    vi.stubGlobal("fetch", fetchMock);
    const reader = new JsonRpcChainReader();
    await expect(
      reader.verifyOracle(request, 12, transactionHash),
    ).rejects.toMatchObject({
      name: "FinalityPendingError",
      confirmations: 5,
    });
  });

  it("rejects a block-pinned read when the canonical hash changes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("0x14a34"))
      .mockResolvedValueOnce(response("0x64"))
      .mockResolvedValueOnce(
        response({ hash: receiptBlockHash, number: "0x64" }),
      )
      .mockResolvedValueOnce(
        response(oracleStatusResult(approvedOracle, 1_800_000_000, true)),
      )
      .mockResolvedValueOnce(response({ hash: headBlockHash, number: "0x64" }));
    vi.stubGlobal("fetch", fetchMock);
    const reader = new JsonRpcChainReader();
    await expect(reader.observeOracle(chainId, market)).rejects.toBeInstanceOf(
      ReorgDetectedError,
    );
  });

  it("reads and validates bounded block logs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("0x14a34"))
      .mockResolvedValueOnce(
        response([
          {
            address: market,
            blockNumber: "0x64",
            blockHash: receiptBlockHash,
            transactionHash,
            logIndex: "0x0",
            topics: [`0x${"3".repeat(64)}`],
            data: "0x",
            removed: false,
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    const reader = new JsonRpcChainReader();
    const logs = await reader.getLogs({
      chainId,
      address: market,
      fromBlock: 100,
      toBlock: 100,
    });
    expect(logs[0]).toMatchObject({
      blockNumber: 100,
      logIndex: 0,
      removed: false,
    });
  });

  it("verifies a canonical, fresh postcondition only after finality", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("0x14a34"))
      .mockResolvedValueOnce(
        response({
          transactionHash,
          blockHash: receiptBlockHash,
          blockNumber: "0x64",
          status: "0x1",
        }),
      )
      .mockResolvedValueOnce(response("0x6f"))
      .mockResolvedValueOnce(
        response({ hash: receiptBlockHash, number: "0x64" }),
      )
      .mockResolvedValueOnce(response("0x6f"))
      .mockResolvedValueOnce(response("0x14a34"))
      .mockResolvedValueOnce(response({ hash: headBlockHash, number: "0x6f" }))
      .mockResolvedValueOnce(
        response(oracleStatusResult(approvedOracle, 1_800_000_000, true)),
      )
      .mockResolvedValueOnce(response({ hash: headBlockHash, number: "0x6f" }));
    vi.stubGlobal("fetch", fetchMock);
    const reader = new JsonRpcChainReader();
    const verification = await reader.verifyOracle(
      request,
      12,
      transactionHash,
    );
    expect(verification).toMatchObject({
      verified: true,
      fresh: true,
      canonical: true,
      confirmations: 12,
      blockHash: headBlockHash,
    });
  });
});
