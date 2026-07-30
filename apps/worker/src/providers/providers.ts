import {
  chainObservationSchema,
  arcadiaSelectors,
  githubReleaseSchema,
  keeperStatusSchema,
  keeperSubmissionSchema,
  simulationResultSchema,
  verificationResultSchema,
  type ChainReader,
  type GitHubProvider,
  type KeeperHubProvider,
  type Simulator,
  type TransactionRequest,
} from "@aether/backend";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

export const CHAIN_READER = Symbol("CHAIN_READER");
export const SIMULATOR = Symbol("SIMULATOR");
export const KEEPER_HUB = Symbol("KEEPER_HUB");
export const GITHUB_PROVIDER = Symbol("GITHUB_PROVIDER");

const approvedOracle = "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311";
const blockHash = `0x${"1".repeat(64)}`;
const transactionHash = `0x${"7".repeat(64)}`;

@Injectable()
export class MockChainReader implements ChainReader {
  async observeOracle(chainId: number, contract: string, blockNumber?: number) {
    return chainObservationSchema.parse({
      chainId,
      contract,
      blockNumber: blockNumber ?? 17_924_118,
      blockHash,
      oracle: approvedOracle,
      oracleUpdatedAt: 1_800_000_000,
      fresh: true,
      canonical: true,
      observedAt: new Date().toISOString(),
    });
  }

  async verifyOracle(
    request: TransactionRequest,
    minimumConfirmations: number,
    _transactionHash?: string,
  ) {
    void _transactionHash;
    return verificationResultSchema.parse({
      verified: true,
      oracle: request.desiredOracle,
      oracleUpdatedAt: 1_800_000_000,
      fresh: true,
      blockNumber: 17_924_130,
      blockHash,
      confirmations: minimumConfirmations,
      canonical: true,
      providerCorrelationId: "rpc-verify-mock",
    });
  }
}

@Injectable()
export class MockSimulator implements Simulator {
  async simulate(
    planHash: string,
    _request: TransactionRequest,
    blockNumber: number,
  ) {
    return simulationResultSchema.parse({
      simulationId: `sim-${planHash.slice(2, 10)}`,
      planHash,
      success: true,
      gasEstimate: "284211",
      postconditionMatched: true,
      blockNumber,
    });
  }
}

@Injectable()
export class MockKeeperHubProvider implements KeeperHubProvider {
  async submit(
    idempotencyKey: string,
    planHash: string,
    request: TransactionRequest,
  ) {
    void planHash;
    void request;
    return keeperSubmissionSchema.parse({
      workflowId: `KH-${idempotencyKey.slice(0, 8)}`,
      providerCorrelationId: idempotencyKey,
      status: "submitted",
      transactionHash,
    });
  }

  async reconcile(providerCorrelationId: string) {
    return keeperStatusSchema.parse({
      workflowId: `KH-${providerCorrelationId.slice(0, 8)}`,
      providerCorrelationId,
      status: "confirmed",
      transactionHash,
      blockNumber: 17_924_125,
      confirmations: 12,
    });
  }
}

const jsonRpcEnvelopeSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});
const rpcBlockSchema = z.object({
  hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  number: z.string().regex(/^0x[a-fA-F0-9]+$/),
});
const rpcReceiptSchema = z.object({
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  blockHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  blockNumber: z.string().regex(/^0x[a-fA-F0-9]+$/),
  status: z.enum(["0x0", "0x1"]),
});

export class ReorgDetectedError extends Error {
  constructor() {
    super("Pinned block hash changed while reading postconditions.");
    this.name = "ReorgDetectedError";
  }
}

export class UnknownReceiptOutcomeError extends Error {
  constructor() {
    super(
      "Transaction receipt is not yet available; submission must not be retried.",
    );
    this.name = "UnknownReceiptOutcomeError";
  }
}

export class FinalityPendingError extends Error {
  constructor(readonly confirmations: number) {
    super(`Only ${confirmations} confirmations are available.`);
    this.name = "FinalityPendingError";
  }
}

async function validatedJson(
  url: string,
  init: RequestInit,
  timeoutMs = 10_000,
): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Provider request failed with HTTP ${response.status}.`);
  }
  return response.json();
}

@Injectable()
export class JsonRpcChainReader implements ChainReader {
  private readonly rpcUrl: string;
  private readonly readCalldata: string;

  constructor() {
    this.rpcUrl = required("AETHER_RPC_URL");
    this.readCalldata =
      process.env.AETHER_ORACLE_READ_CALLDATA ?? arcadiaSelectors.oracleStatus;
  }

  private async rpc(method: string, params: unknown[]): Promise<unknown> {
    const envelope = jsonRpcEnvelopeSchema.parse(
      await validatedJson(this.rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params,
        }),
      }),
    );
    if (envelope.error || envelope.result === undefined) {
      throw new Error(`RPC ${method} returned a validated error response.`);
    }
    return envelope.result;
  }

  private async rpcString(method: string, params: unknown[]): Promise<string> {
    return z.string().parse(await this.rpc(method, params));
  }

  private async blockByTag(tag: string) {
    return rpcBlockSchema.parse(
      await this.rpc("eth_getBlockByNumber", [tag, false]),
    );
  }

  async observeOracle(chainId: number, contract: string, blockNumber?: number) {
    const providerChainId = Number.parseInt(
      await this.rpcString("eth_chainId", []),
      16,
    );
    if (providerChainId !== chainId) {
      throw new Error(
        `RPC chain mismatch: expected ${chainId}, received ${providerChainId}.`,
      );
    }
    const blockTag = blockNumber
      ? `0x${blockNumber.toString(16)}`
      : await this.rpcString("eth_blockNumber", []);
    const blockBefore = await this.blockByTag(blockTag);
    const encoded = await this.rpcString("eth_call", [
      { to: contract, data: this.readCalldata },
      blockTag,
    ]);
    const blockAfter = await this.blockByTag(blockTag);
    if (blockAfter.hash.toLowerCase() !== blockBefore.hash.toLowerCase()) {
      throw new ReorgDetectedError();
    }
    const words = encoded.replace(/^0x/, "").match(/.{64}/g);
    if (!words || words.length < 3) {
      throw new Error("oracleStatus() returned malformed ABI data.");
    }
    const oracle = `0x${words[0]!.slice(-40)}`;
    const oracleUpdatedAt = Number(BigInt(`0x${words[1]!}`));
    const fresh = BigInt(`0x${words[2]!}`) === 1n;
    return chainObservationSchema.parse({
      chainId,
      blockNumber: Number.parseInt(blockBefore.number, 16),
      blockHash: blockBefore.hash,
      contract,
      oracle,
      oracleUpdatedAt,
      fresh,
      canonical: true,
      observedAt: new Date().toISOString(),
    });
  }

  async verifyOracle(
    request: TransactionRequest,
    minimumConfirmations: number,
    transactionHash?: string,
  ) {
    if (!transactionHash) {
      throw new UnknownReceiptOutcomeError();
    }
    const receiptResult = await this.rpc("eth_getTransactionReceipt", [
      transactionHash,
    ]);
    if (receiptResult === null) throw new UnknownReceiptOutcomeError();
    const receipt = rpcReceiptSchema.parse(receiptResult);
    if (receipt.status !== "0x1") {
      throw new Error("Confirmed transaction reverted.");
    }
    const head = Number.parseInt(
      await this.rpcString("eth_blockNumber", []),
      16,
    );
    const receiptBlock = Number.parseInt(receipt.blockNumber, 16);
    const confirmations = Math.max(0, head - receiptBlock + 1);
    if (confirmations < minimumConfirmations) {
      throw new FinalityPendingError(confirmations);
    }
    const canonicalReceiptBlock = await this.blockByTag(receipt.blockNumber);
    if (
      canonicalReceiptBlock.hash.toLowerCase() !==
      receipt.blockHash.toLowerCase()
    ) {
      throw new ReorgDetectedError();
    }
    const observation = await this.observeOracle(
      request.chainId,
      request.target,
      head,
    );
    return verificationResultSchema.parse({
      verified:
        observation.oracle.toLowerCase() ===
          request.desiredOracle.toLowerCase() &&
        observation.fresh &&
        observation.canonical,
      oracle: observation.oracle,
      oracleUpdatedAt: observation.oracleUpdatedAt,
      fresh: observation.fresh,
      blockNumber: observation.blockNumber,
      blockHash: observation.blockHash,
      confirmations,
      canonical: observation.canonical,
      providerCorrelationId: `rpc-${observation.blockHash.slice(2, 14)}`,
    });
  }
}

@Injectable()
export class HttpKeeperHubProvider implements KeeperHubProvider {
  private readonly baseUrl = required("KEEPERHUB_BASE_URL");
  private readonly token = required("KEEPERHUB_API_TOKEN");

  async submit(
    idempotencyKey: string,
    planHash: string,
    request: TransactionRequest,
  ) {
    return keeperSubmissionSchema.parse(
      await validatedJson(`${this.baseUrl}/workflows`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          clientCorrelationId: idempotencyKey,
          planHash,
          transaction: request,
        }),
      }),
    );
  }

  async reconcile(providerCorrelationId: string) {
    return keeperStatusSchema.parse(
      await validatedJson(
        `${this.baseUrl}/workflows/by-correlation/${encodeURIComponent(
          providerCorrelationId,
        )}`,
        {
          method: "GET",
          headers: { authorization: `Bearer ${this.token}` },
        },
      ),
    );
  }
}

@Injectable()
export class HttpSimulator implements Simulator {
  private readonly baseUrl = required("KEEPERHUB_BASE_URL");
  private readonly token = required("KEEPERHUB_API_TOKEN");

  async simulate(
    planHash: string,
    request: TransactionRequest,
    blockNumber: number,
  ) {
    return simulationResultSchema.parse(
      await validatedJson(`${this.baseUrl}/simulations`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ planHash, request, blockNumber }),
      }),
    );
  }
}

@Injectable()
export class HttpGitHubProvider implements GitHubProvider {
  private readonly token = process.env.GITHUB_READ_TOKEN;

  async getRelease(repository: string, tag: string) {
    const [owner, name] = repository.split("/");
    if (!owner || !name)
      throw new Error("GitHub repository must be owner/name.");
    const raw = z
      .object({
        tag_name: z.string(),
        target_commitish: z.string(),
        html_url: z.string().url(),
        published_at: z.string().datetime(),
      })
      .parse(
        await validatedJson(
          `https://api.github.com/repos/${encodeURIComponent(
            owner,
          )}/${encodeURIComponent(name)}/releases/tags/${encodeURIComponent(tag)}`,
          {
            headers: {
              accept: "application/vnd.github+json",
              "user-agent": "aether-worker",
              ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
            },
          },
        ),
      );
    const commit = z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/i) }).parse(
      await validatedJson(
        `https://api.github.com/repos/${encodeURIComponent(
          owner,
        )}/${encodeURIComponent(name)}/commits/${encodeURIComponent(
          raw.target_commitish,
        )}`,
        {
          headers: {
            accept: "application/vnd.github+json",
            "user-agent": "aether-worker",
            ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
          },
        },
      ),
    );
    return githubReleaseSchema.parse({
      repository,
      tag: raw.tag_name,
      commitSha: commit.sha,
      url: raw.html_url,
      publishedAt: raw.published_at,
    });
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required in live provider mode.`);
  return value;
}
